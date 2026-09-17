import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { ResultStorage } from './storage';
import { TaskRunner } from './taskRunner';

const mocks = vi.hoisted(() => ({ files: new Map<string, Uint8Array>() }));
vi.mock('../storagePath', () => ({ getStorageUri: vi.fn(() => ({ path: '/data/result' })) }));
vi.mock('vscode', () => ({
    FileType: { File: 1 },
    FileSystemError: class extends Error { code = 'FileNotFound'; },
    Uri: { joinPath: (uri: vscode.Uri, name: string) => ({ path: `${uri.path}/${name}` }) },
    workspace: {
        fs: {
            createDirectory: vi.fn(),
            readDirectory: async () => [...mocks.files.keys()].map(name => [name.slice('/data/result/'.length), 1]),
            delete: async (uri: vscode.Uri) => { mocks.files.delete(uri.path); },
            readFile: async (uri: vscode.Uri) => {
                const content = mocks.files.get(uri.path);
                if (!content) throw new vscode.FileSystemError();
                return content;
            },
            writeFile: async (uri: vscode.Uri, content: Uint8Array) => { mocks.files.set(uri.path, content); },
            rename: async (source: vscode.Uri, target: vscode.Uri) => {
                mocks.files.set(target.path, mocks.files.get(source.path)!);
                mocks.files.delete(source.path);
            },
        }
    },
}));

describe('result history storage', () => {
    beforeEach(() => { mocks.files.clear(); });

    it('loads an empty directory and persists results without cancellation callbacks', async () => {
        const storage = await ResultStorage.create({} as vscode.ExtensionContext);
        expect(await storage.load()).toEqual([]);
        const runner = new TaskRunner(vi.fn());
        const entry = runner.add({ type: 'http', data: { method: 'GET', url: '/test', state: 'success', body: 'response' } }, vi.fn());
        await storage.persist(runner.history);
        const restored = await (await ResultStorage.create({} as vscode.ExtensionContext)).load();
        expect(restored).toEqual([{ task: entry.task, result: entry.result }]);
        expect([...mocks.files.keys()]).toEqual([`/data/result/${entry.task.startedAt}.json`]);
    });

    it('serializes writes so deleting a record cannot be undone by an earlier save', async () => {
        const storage = await ResultStorage.create({} as vscode.ExtensionContext);
        const runner = new TaskRunner(vi.fn());
        runner.add({ type: 'table', data: { kind: 'command', message: 'OK', summary: 'Done' } });
        await Promise.all([storage.persist(runner.history), storage.persist([])]);
        expect(await storage.load()).toEqual([]);
    });

    it('ignores legacy history without changing it', async () => {
        const content = new TextEncoder().encode('[{"task":{}}]');
        mocks.files.set('/data/result/history.json', content);
        const storage = await ResultStorage.create({} as vscode.ExtensionContext);
        expect(await storage.load()).toEqual([]);
        await storage.persist([]);
        expect(mocks.files.get('/data/result/history.json')).toBe(content);
    });

    it('keeps timestamp filenames stable across updates and deletion', async () => {
        const runner = new TaskRunner(vi.fn());
        const first = runner.add({ type: 'table', data: { kind: 'command', message: 'OK', summary: 'First' } });
        const second = runner.add({ type: 'table', data: { kind: 'command', message: 'OK', summary: 'Second' } });
        first.task.startedAt = second.task.startedAt = 100;
        const storage = await ResultStorage.create({} as vscode.ExtensionContext);
        await storage.persist([first, second]);
        const entries = await storage.load();
        expect(entries).toHaveLength(2);
        expect([...mocks.files.keys()]).toEqual(['/data/result/100.json', '/data/result/101.json']);
        entries[1].task.startedAt = 200;
        await storage.persist([entries[1]]);
        expect([...mocks.files.keys()]).toEqual(['/data/result/101.json']);
        expect(await (await ResultStorage.create({} as vscode.ExtensionContext)).load()).toEqual([entries[1]]);
    });

    it('preserves corrupt and unrelated files and avoids filename collisions', async () => {
        mocks.files.set('/data/result/100.json', new TextEncoder().encode('{'));
        mocks.files.set('/data/result/notes.json', new TextEncoder().encode('{}'));
        const storage = await ResultStorage.create({} as vscode.ExtensionContext);
        expect(await storage.load()).toEqual([]);
        const runner = new TaskRunner(vi.fn());
        const entry = runner.add({ type: 'table', data: { kind: 'command', message: 'OK', summary: 'Done' } });
        entry.task.startedAt = 100;
        await storage.persist([entry]);
        expect([...mocks.files.keys()]).toEqual(['/data/result/100.json', '/data/result/notes.json', '/data/result/101.json']);
        await storage.persist([]);
        expect([...mocks.files.keys()]).toEqual(['/data/result/100.json', '/data/result/notes.json']);
    });
});