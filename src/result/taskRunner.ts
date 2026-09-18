import { randomUUID } from 'node:crypto';
import type { Result, ResultTask, TaskState } from './protocol';

export interface TaskEntry {
    task: ResultTask;
    result: Result;
    cancel?: () => void;
}

export class TaskRunner {
    readonly entries = new Map<string, TaskEntry>();
    readonly sessionId = randomUUID();
    private readonly resultIds = new WeakMap<Result, string>();

    constructor(private readonly changed: (entry: TaskEntry) => void) { }

    get history(): TaskEntry[] {
        return [...this.entries.values()].sort((first, second) => second.task.startedAt - first.task.startedAt || second.task.id.localeCompare(first.task.id));
    }

    restore(entries: TaskEntry[], liveSessions: ReadonlySet<string> = new Set()): void {
        const incomingIds = new Set(entries.map(entry => entry.task.id));
        for (const [id, entry] of this.entries) {
            if (!incomingIds.has(id) && (entry.task.ownerSessionId !== this.sessionId || !this.active(entry.task.state))) {
                this.resultIds.delete(entry.result);
                this.entries.delete(id);
            }
        }
        for (const entry of entries) {
            const existing = this.entries.get(entry.task.id);
            if (existing?.task.ownerSessionId === this.sessionId) continue;
            if (existing) this.resultIds.delete(existing.result);
            entry.cancel = undefined;
            entry.task.cancellable = false;
            entry.task.executionStatus = this.active(entry.task.state)
                ? entry.task.ownerSessionId && liveSessions.has(entry.task.ownerSessionId) ? 'external' : 'unknown'
                : undefined;
            this.entries.set(entry.task.id, entry);
            this.resultIds.set(entry.result, entry.task.id);
        }
    }

    add(result: Result, cancel?: () => void): TaskEntry {
        const existing = this.find(result);
        if (existing) return existing;
        const entry: TaskEntry = {
            result, cancel,
            task: {
                id: randomUUID(), ownerSessionId: this.sessionId, type: result.type,
                label: result.type === 'workflow' ? result.data.name : result.type === 'http' ? `${result.data.method} ${result.data.url}` : result.data.source ?? result.data.label ?? 'SQL query',
                state: this.state(result), startedAt: Date.now(), cancellable: Boolean(cancel),
            },
        };
        if (!this.active(entry.task.state)) entry.task.finishedAt = Date.now();
        this.entries.set(entry.task.id, entry);
        this.resultIds.set(result, entry.task.id);
        return entry;
    }

    find(result: Result): TaskEntry | undefined {
        const id = this.resultIds.get(result);
        return id ? this.entries.get(id) : undefined;
    }

    update(result: Result): void {
        const entry = this.find(result);
        if (!entry || entry.task.ownerSessionId !== this.sessionId) return;
        this.finish(entry, this.state(result));
    }

    cancel(id: string): void {
        const entry = this.entries.get(id);
        if (!entry?.cancel || entry.task.state !== 'running') return;
        entry.task.state = 'stopping';
        this.changed(entry);
        entry.cancel();
    }

    remove(id: string): boolean {
        const entry = this.entries.get(id);
        if (!entry || this.active(entry.task.state)) return false;
        this.entries.delete(id);
        this.resultIds.delete(entry.result);
        return true;
    }

    async run(result: Result, show: () => Promise<void>, execute: (signal: AbortSignal) => Promise<void>): Promise<void> {
        const controller = new AbortController();
        const entry = this.add(result, () => controller.abort());
        entry.task.state = 'running';
        entry.task.finishedAt = undefined;
        try {
            await show();
            controller.signal.throwIfAborted();
            await execute(controller.signal);
            if (controller.signal.aborted) controller.signal.throwIfAborted();
            this.finish(entry, controller.signal.aborted ? 'cancelled' : this.state(result));
        } catch (error) {
            const state = controller.signal.aborted ? 'cancelled' : 'error';
            const message = state === 'cancelled' ? 'Task cancelled.' : error instanceof Error ? error.message : String(error);
            if (result.type === 'http') Object.assign(result.data, { state, message });
            if (result.type === 'table') result.data = { ...result.data, kind: 'command', summary: message, message };
            this.finish(entry, state);
        }
    }

    dispose(): void {
        for (const entry of this.entries.values()) {
            if (entry.task.state === 'running') this.cancel(entry.task.id);
        }
    }

    private finish(entry: TaskEntry, state: TaskState): void {
        entry.task.state = state;
        if (!this.active(state)) {
            entry.task.finishedAt ??= Date.now();
            entry.cancel = undefined;
            entry.task.cancellable = false;
        }
        this.changed(entry);
    }

    private active(state: TaskState): boolean {
        return state === 'running' || state === 'stopping';
    }

    private state(result: Result): TaskState {
        if (result.type === 'table') return 'success';
        return result.data.state === 'loading' ? 'running' : result.data.state;
    }
}