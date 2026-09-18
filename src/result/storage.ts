import * as vscode from 'vscode';
import { getStorageUri } from '../storagePath';
import type { TaskEntry } from './taskRunner';

export class ResultStorage {
    private pending = Promise.resolve();
    private readonly taskFiles = new Map<string, string>();

    private constructor(private readonly directory: vscode.Uri) { }

    static async create(context: vscode.ExtensionContext): Promise<ResultStorage> {
        const directory = getStorageUri(context, 'result');
        await vscode.workspace.fs.createDirectory(directory);
        const storage = new ResultStorage(directory);
        return storage;
    }

    async load(): Promise<TaskEntry[]> {
        await this.pending;
        const tasks = new Map<string, TaskEntry>();
        for (const [name, type] of await vscode.workspace.fs.readDirectory(this.directory)) {
            if (type !== vscode.FileType.File || !/^(?:\d+|[0-9a-f-]{36})\.json$/.test(name)) continue;
            let entry: unknown;
            try {
                entry = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(this.directory, name))));
            } catch {
                continue;
            }
            if (!isTaskEntry(entry) || tasks.has(entry.task.id)) continue;
            this.taskFiles.set(entry.task.id, name);
            tasks.set(entry.task.id, entry);
        }
        return [...tasks.values()];
    }

    persist(entries: TaskEntry[]): Promise<void> {
        const snapshots = entries.map(({ task, result }) => ({
            id: task.id,
            content: new TextEncoder().encode(`${JSON.stringify({ task: { ...task, executionStatus: undefined }, result }, undefined, 2)}\n`),
        }));
        const write = this.pending.then(async () => {
            for (const snapshot of snapshots) {
                const filename = this.taskFiles.get(snapshot.id) ?? `${snapshot.id}.json`;
                this.taskFiles.set(snapshot.id, filename);
                const temporary = vscode.Uri.joinPath(this.directory, `${filename}.tmp`);
                await vscode.workspace.fs.writeFile(temporary, snapshot.content);
                await vscode.workspace.fs.rename(temporary, vscode.Uri.joinPath(this.directory, filename), { overwrite: true });
            }
        });
        this.pending = write.catch(() => { });
        return write;
    }

    remove(id: string): Promise<void> {
        const write = this.pending.then(async () => {
            const filename = this.taskFiles.get(id);
            if (!filename) return;
            await this.deleteFile(filename);
            this.taskFiles.delete(id);
        });
        this.pending = write.catch(() => { });
        return write;
    }

    async heartbeat(sessionId: string): Promise<void> {
        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(this.directory, `session-${sessionId}.json`),
            new TextEncoder().encode(JSON.stringify({ updatedAt: Date.now() })));
    }

    async liveSessions(): Promise<Set<string>> {
        const sessions = new Set<string>();
        for (const [name, type] of await vscode.workspace.fs.readDirectory(this.directory)) {
            const match = /^session-([0-9a-f-]{36})\.json$/.exec(name);
            if (type !== vscode.FileType.File || !match) continue;
            try {
                const value = JSON.parse(new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(this.directory, name))));
                if (typeof value.updatedAt === 'number' && Date.now() - value.updatedAt < 30_000) sessions.add(match[1]);
            } catch {
                continue;
            }
        }
        return sessions;
    }

    endSession(sessionId: string): Promise<void> {
        return this.deleteFile(`session-${sessionId}.json`);
    }

    private async deleteFile(name: string): Promise<void> {
        try {
            await vscode.workspace.fs.delete(vscode.Uri.joinPath(this.directory, name));
        } catch (error) {
            if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) throw error;
        }
    }
}

function isTaskEntry(value: unknown): value is TaskEntry {
    if (!value || typeof value !== 'object') return false;
    const { task, result } = value as Partial<TaskEntry>;
    if (!task || !result || !result.data || typeof task.id !== 'string' || typeof task.label !== 'string'
        || !Number.isFinite(task.startedAt) || task.type !== result.type
        || !['running', 'stopping', 'success', 'error', 'cancelled'].includes(task.state)) return false;
    if (result.type === 'http') return typeof result.data.method === 'string' && typeof result.data.url === 'string';
    if (result.type === 'table') return typeof result.data.summary === 'string' && (result.data.kind === 'command'
        ? typeof result.data.message === 'string'
        : result.data.kind === 'rows' && Array.isArray(result.data.columns) && Array.isArray(result.data.rows));
    return result.type === 'workflow' && typeof result.data.name === 'string' && typeof result.data.output === 'string'
        && Array.isArray(result.data.steps) && result.data.steps.every(step => step && typeof step.name === 'string' && typeof step.output === 'string');
}