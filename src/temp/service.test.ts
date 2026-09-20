import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { TempService } from './service';
import { tempUri } from './fileSystem';

const documents = vi.hoisted(() => [] as vscode.TextDocument[]);
const events = vi.hoisted(() => ({ change: vi.fn(), save: vi.fn(), close: vi.fn() }));
vi.mock('vscode', () => ({
    Disposable: class { constructor(public dispose: () => void) { } },
    EventEmitter: class { event = vi.fn(); fire = vi.fn(); dispose = vi.fn(); },
    FileType: { File: 1, Directory: 2 },
    FileChangeType: { Changed: 1, Created: 2, Deleted: 3 },
    FileSystemError: class extends Error {
        static NoPermissions(message: unknown) { return new this(String(message)); }
        static FileNotFound() { return new this('FileNotFound'); }
        static FileExists() { return new this('FileExists'); }
        static FileIsADirectory() { return new this('FileIsADirectory'); }
    },
    WorkspaceEdit: class { deleteFile = vi.fn(); renameFile = vi.fn(); },
    Uri: {
        file: (fsPath: string) => ({ fsPath, path: fsPath, scheme: 'file', toString: () => fsPath }),
        from: ({ scheme, path }: { scheme: string; path: string }) => ({ scheme, path, authority: '', query: '', fragment: '', toString: () => `${scheme}:${path}` }),
    },
    workspace: {
        isTrusted: true,
        workspaceFolders: [],
        fs: { delete: vi.fn() },
        textDocuments: documents, openTextDocument: vi.fn(), applyEdit: vi.fn().mockResolvedValue(true),
        registerFileSystemProvider: vi.fn(() => ({ dispose: vi.fn() })),
        onDidChangeTextDocument: vi.fn(listener => { events.change = listener; return { dispose: vi.fn() }; }),
        onDidSaveTextDocument: vi.fn(listener => { events.save = listener; return { dispose: vi.fn() }; }),
        onDidCloseTextDocument: vi.fn(listener => { events.close = listener; return { dispose: vi.fn() }; }),
    },
    window: { showTextDocument: vi.fn(), showErrorMessage: vi.fn(), showWarningMessage: vi.fn(), showInputBox: vi.fn(), showQuickPick: vi.fn() },
}));
vi.mock('../storagePath', () => ({
    getStorageUri: (context: { globalStorageUri: { fsPath: string } }, directory: string) => ({ fsPath: join(context.globalStorageUri.fsPath, directory) }),
}));

describe('Temp storage and auto-save', () => {
    let root: string;
    let service: TempService;
    beforeEach(async () => {
        vi.useFakeTimers();
        root = await mkdtemp(join(tmpdir(), 'toolkit-temp-'));
        service = new TempService({ globalStorageUri: vscode.Uri.file(root) } as vscode.ExtensionContext);
        documents.splice(0);
        vi.mocked(vscode.workspace).isTrusted = true;
        vi.mocked(vscode.workspace).workspaceFolders = [];
        vi.mocked(vscode.workspace.fs.delete).mockImplementation(async (uri, options) => {
            await rm(uri.fsPath, { recursive: options?.recursive });
        });
    });
    afterEach(async () => {
        service.dispose();
        vi.useRealTimers();
        await rm(root, { recursive: true, force: true });
    });
    function document(file: string, dirty = true) {
        const relative = file.startsWith(join(root, 'temp') + '/') ? file.slice(join(root, 'temp').length + 1) : undefined;
        const document = { uri: relative === undefined ? vscode.Uri.file(file) : tempUri(relative), isDirty: dirty, isClosed: false, save: vi.fn().mockResolvedValue(true) };
        documents.push(document as unknown as vscode.TextDocument);
        return document;
    }
    async function flushSave() {
        events.change({ document: documents[0], contentChanges: [{}] });
        await vi.advanceTimersByTimeAsync(500);
        await vi.waitFor(() => expect(vi.mocked(vscode.workspace.textDocuments)[0].save).toHaveBeenCalled());
    }
    it('creates and opens a Temp file without a dashboard webview', async () => {
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('quick.txt');
        await service.handle({ type: 'newFile' });
        expect(await readFile(join(root, 'temp/quick.txt'), 'utf8')).toBe('');
        expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ scheme: 'toolkit-temp', path: '/quick.txt' }));
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });
    it('does not create or open a file when the shortcut prompt is cancelled', async () => {
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(undefined);
        await service.handle({ type: 'newFile' });
        expect(await service.list('')).toEqual([]);
        expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
    });
    it('declares the New Temp File command and platform shortcuts', async () => {
        const manifest = JSON.parse(await readFile('package.json', 'utf8'));
        expect(manifest.contributes.commands).toContainEqual(expect.objectContaining({ command: 'vscode-toolkit.temp.newFile', title: 'New Temp File' }));
        expect(manifest.contributes.keybindings).toContainEqual({ command: 'vscode-toolkit.temp.newFile', key: 'ctrl+shift+,', mac: 'cmd+shift+,' });
    });
    it.each([
        ['note.txt', 'note-1.txt', 'note-2.txt'],
        ['note', 'note-1', 'note-2'],
        ['.env', '.env-1', '.env-2'],
    ])('increments duplicate new files named %s without overwriting', async (name, first, second) => {
        await service.create('', name, false);
        await writeFile(join(root, 'temp', name), 'keep');
        await service.create('', first, false);
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce(name);
        await service.handle({ type: 'newFile' });
        expect(await readFile(join(root, 'temp', name), 'utf8')).toBe('keep');
        expect(await readFile(join(root, 'temp', second), 'utf8')).toBe('');
        expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ path: `/${second}` }));
    });
    it('creates distinct files for concurrent requests with the same name', async () => {
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('note.txt').mockResolvedValueOnce('note.txt');
        await Promise.all([service.handle({ type: 'newFile' }), service.handle({ type: 'newFile' })]);
        expect((await service.list('')).map(entry => entry.name).sort()).toEqual(['note-1.txt', 'note.txt']);
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    });
    it('does not retry invalid names as numbered files', async () => {
        vi.mocked(vscode.window.showInputBox).mockResolvedValueOnce('../invalid.txt');
        await service.handle({ type: 'newFile' });
        expect(vscode.window.showErrorMessage).toHaveBeenCalledOnce();
        expect(await service.list('')).toEqual([]);
    });
    it('creates nested files under storage/temp and preserves existing contents', async () => {
        expect(await service.list('')).toEqual([]);
        await service.create('', 'notes', true);
        await service.create('notes', 'draft.md', false);
        await writeFile(join(root, 'temp/notes/draft.md'), 'keep');
        await expect(service.create('notes', 'draft.md', false)).rejects.toThrow();
        expect(await readFile(join(root, 'temp/notes/draft.md'), 'utf8')).toBe('keep');
        expect(await service.list('notes')).toEqual([{ name: 'draft.md', path: 'notes/draft.md', directory: false }]);
    });
    it('allows folders only at the root and files within first-level folders', async () => {
        await service.create('', 'notes', true);
        await expect(service.create('notes', 'nested', true)).rejects.toThrow('Temp root');
        await expect(service.create('./notes', 'nested', true)).rejects.toThrow('Temp root');
        await service.create('notes', 'draft.txt', false);
        await service.create('', 'root.txt', false);
        expect(await service.list('notes')).toHaveLength(1);
        await expect(service.create('', 'bad\0name', false)).rejects.toThrow('path separators');
    });
    it.each(['newFile', 'newFolder'])('rejects dashboard %s requests within folders', async type => {
        const postMessage = vi.fn().mockResolvedValue(true);
        await service.handle({ type, directory: 'notes' }, { postMessage } as unknown as vscode.Webview);
        expect(vscode.window.showInputBox).not.toHaveBeenCalled();
        expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', message: expect.stringContaining('at the root') }));
    });
    it('rejects traversal and symlinks outside Temp', async () => {
        await service.list('');
        await symlink(root, join(root, 'temp/outside'));
        await expect(service.list('../')).rejects.toThrow('inside Temp');
        await expect(service.list('outside')).rejects.toThrow('inside Temp');
        await expect(service.create('', '../escape', false)).rejects.toThrow('path separators');
        expect(await service.list('')).toEqual([]);
    });
    it('opens files in a persistent text editor', async () => {
        await service.create('', 'draft.txt', false);
        await service.open('draft.txt');
        expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ scheme: 'toolkit-temp', path: '/draft.txt' }));
        expect(vi.mocked(vscode.workspace.openTextDocument).mock.calls[0][0]?.toString()).not.toContain(root);
        expect(vscode.window.showTextDocument).toHaveBeenCalledWith(undefined, { preview: false });
    });
    it('saves only dirty Temp documents after 500ms of inactivity', async () => {
        await service.create('', 'draft.txt', false);
        const draft = document(join(root, 'temp/draft.txt'));
        const outside = document(join(root, 'temp-other/draft.txt'));
        const clean = document(join(root, 'temp/clean.txt'), false);
        events.change({ document: draft, contentChanges: [{}] });
        events.change({ document: outside, contentChanges: [{}] });
        events.change({ document: clean, contentChanges: [{}] });
        await vi.advanceTimersByTimeAsync(400);
        expect(draft.save).not.toHaveBeenCalled();
        events.change({ document: draft, contentChanges: [{}] });
        await vi.advanceTimersByTimeAsync(400);
        expect(draft.save).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(100);
        await vi.waitFor(() => expect(draft.save).toHaveBeenCalledOnce());
        expect(outside.save).not.toHaveBeenCalled();
        expect(clean.save).not.toHaveBeenCalled();
        service.dispose();
        const count = draft.save.mock.calls.length;
        await vi.advanceTimersByTimeAsync(10000);
        expect(draft.save).toHaveBeenCalledTimes(count);
    });
    it.each(['save', 'close', 'dispose'])('cancels pending auto-save on %s', async action => {
        await service.create('', 'draft.txt', false);
        const draft = document(join(root, 'temp/draft.txt'));
        events.change({ document: draft, contentChanges: [{}] });
        if (action === 'dispose') service.dispose();
        else events[action as 'save' | 'close'](draft);
        await vi.advanceTimersByTimeAsync(1000);
        expect(draft.save).not.toHaveBeenCalled();
    });
    it('ignores document events without content changes', async () => {
        const draft = document(join(root, 'temp/draft.txt'));
        events.change({ document: draft, contentChanges: [] });
        await vi.advanceTimersByTimeAsync(1000);
        expect(draft.save).not.toHaveBeenCalled();
    });
    it('reports save failures and retries after further edits', async () => {
        await service.create('', 'draft.txt', false);
        const draft = document(join(root, 'temp/draft.txt'));
        draft.save.mockResolvedValue(false);
        await flushSave();
        await vi.waitFor(() => expect(vscode.window.showWarningMessage).toHaveBeenCalledOnce());
        draft.save.mockResolvedValue(true);
        events.change({ document: draft, contentChanges: [{}] });
        await vi.advanceTimersByTimeAsync(500);
        await vi.waitFor(() => expect(draft.save).toHaveBeenCalledTimes(2));
        expect(vscode.window.showWarningMessage).toHaveBeenCalledOnce();
    });
    it('deletes without confirmation and cancels pending saves', async () => {
        await service.create('', 'notes', true);
        await service.create('notes', 'draft.txt', false);
        const draft = document(join(root, 'temp/notes/draft.txt'));
        events.change({ document: draft, contentChanges: [{}] });
        await service.delete('notes');
        expect(vscode.workspace.applyEdit).toHaveBeenCalledOnce();
        const edit = vi.mocked(vscode.workspace.applyEdit).mock.calls[0][0];
        expect(edit.deleteFile).toHaveBeenCalledWith(expect.objectContaining({ scheme: 'toolkit-temp', path: '/notes' }), { recursive: true });
        await vi.advanceTimersByTimeAsync(1000);
        expect(draft.save).not.toHaveBeenCalled();
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });
    it('rejects deletion of root and outside paths', async () => {
        await expect(service.delete('')).rejects.toThrow('Cannot delete');
        await expect(service.delete('..')).rejects.toThrow('inside Temp');
        expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
    });
    it.each([false, true])('moves items to the system trash with recursive=%s', async recursive => {
        const provider = vi.mocked(vscode.workspace.registerFileSystemProvider).mock.calls[0][1];
        await service.create('', 'item', recursive);
        if (recursive) await service.create('item', 'draft.txt', false);
        await provider.delete(tempUri('item'), { recursive });
        expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(expect.objectContaining({ scheme: 'file' }), { recursive, useTrash: true });
        expect(await service.list('')).toEqual([]);
    });
    it('preserves files when trash fails instead of permanently deleting them', async () => {
        const provider = vi.mocked(vscode.workspace.registerFileSystemProvider).mock.calls[0][1];
        await service.create('', 'draft.txt', false);
        await writeFile(join(root, 'temp/draft.txt'), 'keep');
        vi.mocked(vscode.workspace.fs.delete).mockRejectedValueOnce(new Error('Trash unavailable'));
        await expect(provider.delete(tempUri('draft.txt'), { recursive: false })).rejects.toThrow();
        expect(await readFile(join(root, 'temp/draft.txt'), 'utf8')).toBe('keep');
        expect(vscode.workspace.fs.delete).toHaveBeenCalledTimes(1);
    });
    it('reads and saves virtual files without exposing storage paths', async () => {
        const provider = vi.mocked(vscode.workspace.registerFileSystemProvider).mock.calls[0][1];
        await service.create('', 'draft.txt', false);
        const uri = tempUri('draft.txt');
        await provider.writeFile(uri, Buffer.from('long content'), { create: false, overwrite: true });
        await provider.writeFile(uri, Buffer.from('short'), { create: false, overwrite: true });
        expect(Buffer.from(await provider.readFile(uri)).toString()).toBe('short');
        expect(await readFile(join(root, 'temp/draft.txt'), 'utf8')).toBe('short');
        await expect(provider.writeFile(uri, Buffer.from('no'), { create: true, overwrite: false })).rejects.toThrow('FileExists');
        await expect(provider.writeFile(tempUri('missing.txt'), Buffer.from('no'), { create: false, overwrite: true })).rejects.toThrow('FileNotFound');
        await provider.writeFile(tempUri('created.txt'), Buffer.from('created'), { create: true, overwrite: false });
        expect(await readFile(join(root, 'temp/created.txt'), 'utf8')).toBe('created');
        await provider.delete(uri, { recursive: false });
        await expect(provider.readFile(uri)).rejects.toThrow('FileNotFound');
    });
    it('restricts virtual navigation and rejects external symlinks without leaking disk paths', async () => {
        const provider = vi.mocked(vscode.workspace.registerFileSystemProvider).mock.calls[0][1];
        await service.create('', 'notes', true);
        expect(await provider.readDirectory(tempUri(''))).toEqual([['notes', vscode.FileType.Directory]]);
        await expect(provider.readFile(tempUri('../secret'))).rejects.toThrow('Invalid Temp path');
        await symlink(root, join(root, 'temp/outside'));
        await expect(provider.readDirectory(tempUri('outside'))).rejects.toThrow('Unable to access the Temp item.');
        await expect(provider.delete(tempUri(''), { recursive: true })).rejects.toThrow('Cannot delete');
        await expect(provider.createDirectory(tempUri('notes/nested'))).rejects.toThrow('Temp root');
    });
    it('moves virtual files into a folder and back without overwriting conflicts', async () => {
        const provider = vi.mocked(vscode.workspace.registerFileSystemProvider).mock.calls[0][1];
        await service.create('', 'notes', true);
        await service.create('', 'draft.txt', false);
        await writeFile(join(root, 'temp/draft.txt'), 'draft');
        await provider.rename(tempUri('draft.txt'), tempUri('notes/draft.txt'), { overwrite: false });
        expect(await readFile(join(root, 'temp/notes/draft.txt'), 'utf8')).toBe('draft');
        await service.create('', 'draft.txt', false);
        await expect(provider.rename(tempUri('notes/draft.txt'), tempUri('draft.txt'), { overwrite: false })).rejects.toThrow('FileExists');
        expect(await readFile(join(root, 'temp/draft.txt'), 'utf8')).toBe('');
        await provider.delete(tempUri('draft.txt'), { recursive: false });
        await provider.rename(tempUri('notes/draft.txt'), tempUri('draft.txt'), { overwrite: false });
        expect(await readFile(join(root, 'temp/draft.txt'), 'utf8')).toBe('draft');
        await expect(provider.rename(tempUri('notes'), tempUri('other'), { overwrite: false })).rejects.toThrow('FileIsADirectory');
        await expect(provider.rename(tempUri('draft.txt'), tempUri('../escape'), { overwrite: false })).rejects.toThrow('Invalid Temp path');
    });
    it('selects a folder and saves dirty documents before a virtual workspace move', async () => {
        await service.create('', 'notes', true);
        await service.create('', 'draft.txt', false);
        const draft = document(join(root, 'temp/draft.txt'));
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce({ label: 'notes', directory: 'notes' } as never);
        expect(await service.selectFolder('draft.txt')).toBe('notes');
        expect(draft.save).toHaveBeenCalledOnce();
        const edit = vi.mocked(vscode.workspace.applyEdit).mock.calls[0][0];
        expect(edit.renameFile).toHaveBeenCalledWith(expect.objectContaining({ path: '/draft.txt', scheme: 'toolkit-temp' }), expect.objectContaining({ path: '/notes/draft.txt', scheme: 'toolkit-temp' }), { overwrite: false });
        expect(vscode.window.showQuickPick).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ directory: '' }), expect.objectContaining({ directory: 'notes' })]), expect.anything());
    });
    it('offers only global Temp folders even when a workspace is open', async () => {
        vi.mocked(vscode.workspace).workspaceFolders = [{ name: 'Project', index: 0, uri: vscode.Uri.file(join(root, 'project')) }];
        await service.create('', 'draft.txt', false);
        await service.create('', 'notes', true);
        expect((await service.list('')).map(entry => entry.name)).toEqual(['notes', 'draft.txt']);
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);
        await service.selectFolder('draft.txt');
        expect(vscode.window.showQuickPick).toHaveBeenCalledWith([
            expect.objectContaining({ label: 'Temp (root)', directory: '' }),
            expect.objectContaining({ label: 'notes', directory: 'notes' }),
        ], expect.anything());
    });
    it('does not move after cancellation, selecting the current folder, or a failed save', async () => {
        await service.create('', 'draft.txt', false);
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce(undefined);
        expect(await service.selectFolder('draft.txt')).toBeUndefined();
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce({ label: 'Temp (root)', directory: '' } as never);
        expect(await service.selectFolder('draft.txt')).toBeUndefined();
        await service.create('', 'notes', true);
        const draft = document(join(root, 'temp/draft.txt'));
        draft.save.mockResolvedValue(false);
        vi.mocked(vscode.window.showQuickPick).mockResolvedValueOnce({ label: 'notes', directory: 'notes' } as never);
        await expect(service.selectFolder('draft.txt')).rejects.toThrow('Unable to save');
        expect(vscode.workspace.applyEdit).not.toHaveBeenCalled();
    });
});