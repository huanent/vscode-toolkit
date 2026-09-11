import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { SessionStorage } from './storage';

const mocks = vi.hoisted(() => ({ files: new Map<string, Uint8Array>() }));

vi.mock('../../storagePath', () => ({ getStorageUri: () => ({ path: '/chat' }) }));
vi.mock('vscode', () => ({
	FileType: { File: 1 },
	FileSystemError: class extends Error {},
	Uri: { joinPath: (uri: vscode.Uri, name: string) => ({ path: `${uri.path}/${name}` }) },
	workspace: { fs: {
		createDirectory: vi.fn(),
		readDirectory: async () => [...mocks.files.keys()].map(name => [name.slice(6), 1]),
		readFile: async (uri: vscode.Uri) => mocks.files.get(uri.path),
		writeFile: async (uri: vscode.Uri, content: Uint8Array) => { mocks.files.set(uri.path, content); },
		delete: async (uri: vscode.Uri) => { mocks.files.delete(uri.path); },
		rename: vi.fn(async (source: vscode.Uri, target: vscode.Uri) => {
			if (mocks.files.has(target.path)) { throw new Error('File exists'); }
			mocks.files.set(target.path, mocks.files.get(source.path)!);
			mocks.files.delete(source.path);
		}),
	} },
}));

const session = (id: string, updatedAt = 1700000000000) => ({
	id, updatedAt, summary: 'Chat', messages: [{ role: 'user' as const, content: 'Hello' }],
});
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const createStorage = () => SessionStorage.create({} as vscode.ExtensionContext);

describe('Chat session filenames', () => {
	beforeEach(() => { mocks.files.clear(); });

	it('migrates old names without changing bytes and reserves existing timestamps', async () => {
		const legacy = session('old');
		const existing = session('existing');
		const bytes = encode(legacy);
		mocks.files.set('/chat/old.json', bytes);
		mocks.files.set('/chat/1700000000000.json', encode(existing));
		const storage = await createStorage();
		expect(await storage.load()).toEqual([legacy, existing]);
		expect(mocks.files.has('/chat/old.json')).toBe(false);
		expect(mocks.files.get('/chat/1700000000001.json')).toEqual(bytes);
		expect(vscode.workspace.fs.rename).toHaveBeenCalledWith(
			{ path: '/chat/old.json' }, { path: '/chat/1700000000001.json' }, { overwrite: false },
		);
		const reloaded = await createStorage();
		expect(await reloaded.load()).toHaveLength(2);
	});

	it('keeps filenames stable on update and deletes the correct file', async () => {
		const storage = await createStorage();
		await storage.load();
		await storage.persist([session('first'), session('second')]);
		expect([...mocks.files.keys()]).toEqual(['/chat/1700000000000.json', '/chat/1700000000001.json']);
		const updated = session('second', 1800000000000);
		await storage.persist([updated]);
		expect([...mocks.files.keys()]).toEqual(['/chat/1700000000001.json']);
		expect(JSON.parse(new TextDecoder().decode(mocks.files.get('/chat/1700000000001.json')))).toEqual(updated);
	});

	it('ignores unrelated or corrupt files without overwriting them', async () => {
		mocks.files.set('/chat/notes.json', encode(session('unrelated')));
		mocks.files.set('/chat/1700000000000.json', encode({ invalid: true }));
		mocks.files.set('/chat/broken.json', new TextEncoder().encode('{'));
		const storage = await createStorage();
		expect(await storage.load()).toEqual([]);
		await storage.persist([session('new')]);
		expect(mocks.files.size).toBe(4);
		expect(mocks.files.has('/chat/1700000000001.json')).toBe(true);
	});
});