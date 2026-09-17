import * as vscode from 'vscode';
import { getStorageUri } from '../storagePath';
import type { TaskEntry } from './taskRunner';

export class ResultStorage {
    private pending = Promise.resolve();
    private readonly taskFiles = new Map<string, string>();
    private readonly reservedNames = new Set<string>();

    private constructor(private readonly directory: vscode.Uri) { }

    static async create(context: vscode.ExtensionContext): Promise<ResultStorage> {
        const directory = getStorageUri(context, 'result');
        await vscode.workspace.fs.createDirectory(directory);
        const storage = new ResultStorage(directory);
        for (const [name] of await vscode.workspace.fs.readDirectory(directory)) storage.reservedNames.add(name);
        return storage;
    }

    async load(): Promise<TaskEntry[]> {
        await this.pending;
        const tasks = new Map<string, TaskEntry>();
        for (const [name, type] of await vscode.workspace.fs.readDirectory(this.directory)) {
            this.reservedNames.add(name);
            if (type !== vscode.FileType.File || !/^\d+\.json$/.test(name)) continue;
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
            id: task.id, startedAt: task.startedAt,
            content: new TextEncoder().encode(`${JSON.stringify({ task, result }, undefined, 2)}\n`),
        }));
        const write = this.pending.then(async () => {
            for (const snapshot of snapshots) {
                const filename = this.taskFiles.get(snapshot.id) ?? this.reserveFilename(snapshot.startedAt);
                this.taskFiles.set(snapshot.id, filename);
                const temporary = vscode.Uri.joinPath(this.directory, `${filename}.tmp`);
                await vscode.workspace.fs.writeFile(temporary, snapshot.content);
                await vscode.workspace.fs.rename(temporary, vscode.Uri.joinPath(this.directory, filename), { overwrite: true });
            }
            const currentIds = new Set(snapshots.map(snapshot => snapshot.id));
            for (const [id, filename] of this.taskFiles) {
                if (currentIds.has(id)) continue;
                try {
                    await vscode.workspace.fs.delete(vscode.Uri.joinPath(this.directory, filename));
                } catch (error) {
                    if (!(error instanceof vscode.FileSystemError && error.code === 'FileNotFound')) throw error;
                }
                this.taskFiles.delete(id);
            }
        });
        this.pending = write.catch(() => { });
        return write;
    }

    private reserveFilename(startedAt: number): string {
        let timestamp = Number.isSafeInteger(startedAt) && startedAt >= 0 && startedAt < Number.MAX_SAFE_INTEGER
            ? startedAt : Date.now();
        while (this.reservedNames.has(`${timestamp}.json`) || this.reservedNames.has(`${timestamp}.json.tmp`)) timestamp += 1;
        const filename = `${timestamp}.json`;
        this.reservedNames.add(filename);
        return filename;
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