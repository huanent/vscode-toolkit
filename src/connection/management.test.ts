import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { loadConnectionOrder, manageConnection, registerConnectionStore } from './management';

vi.mock('../storagePath', () => ({ getStorageUri: () => '/connection' }));
vi.mock('vscode', () => ({
    Uri: { joinPath: (...parts: string[]) => parts.join('/') },
    workspace: {
        fs: {
            readFile: vi.fn(async () => Buffer.from('[]')),
            createDirectory: vi.fn(), writeFile: vi.fn(), rename: vi.fn(),
        }
    },
    window: { showInputBox: vi.fn(), showWarningMessage: vi.fn() },
}));

describe('unified connection management', () => {
    const context = {} as vscode.ExtensionContext;
    const disposables: vscode.Disposable[] = [];
    const ssh = { getServers: () => [{ id: 'one', group: 'Production' }], renameGroup: vi.fn(), deleteServers: vi.fn() };
    const database = { getServers: () => [{ id: 'two', group: 'Production' }], renameGroup: vi.fn(), deleteServers: vi.fn() };
    const container = { getServers: () => [{ id: 'three', group: 'Development' }], renameGroup: vi.fn(), deleteServers: vi.fn() };
    beforeEach(async () => {
        vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(Buffer.from('[]'));
        await loadConnectionOrder(context);
        disposables.push(registerConnectionStore('ssh', ssh), registerConnectionStore('database', database), registerConnectionStore('container', container));
    });
    afterEach(() => { disposables.splice(0).forEach(disposable => disposable.dispose()); });

    it('moves a connection across type boundaries and persists the order', async () => {
        const publish = vi.fn();
        await manageConnection(context, 'database', 'up', 'two', publish);
        expect(publish).toHaveBeenLastCalledWith(['database:two', 'ssh:one', 'container:three']);
        expect(vscode.workspace.fs.rename).toHaveBeenCalledWith(expect.any(String), '/connection/order.json', { overwrite: true });
    });

    it('moves a whole mixed group', async () => {
        const publish = vi.fn();
        await manageConnection(context, 'connection', 'groupDown', 'Production', publish);
        expect(publish).toHaveBeenLastCalledWith(['container:three', 'ssh:one', 'database:two']);
    });

    it('renames all connection types with one prompt', async () => {
        vi.mocked(vscode.window.showInputBox).mockResolvedValue('Live');
        await manageConnection(context, 'connection', 'groupRename', 'Production', vi.fn());
        expect(vscode.window.showInputBox).toHaveBeenCalledOnce();
        expect(ssh.renameGroup).toHaveBeenCalledWith('Production', 'Live');
        expect(database.renameGroup).toHaveBeenCalledWith('Production', 'Live');
    });

    it('deletes members across types with one confirmation', async () => {
        vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Delete' as never);
        await manageConnection(context, 'connection', 'groupDelete', 'Production', vi.fn());
        expect(vscode.window.showWarningMessage).toHaveBeenCalledOnce();
        expect(ssh.deleteServers).toHaveBeenCalledWith(['one']);
        expect(database.deleteServers).toHaveBeenCalledWith(['two']);
        expect(container.deleteServers).toHaveBeenCalledWith([]);
    });

    it('does not mutate stores when deletion is cancelled', async () => {
        vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined);
        await manageConnection(context, 'connection', 'groupDelete', 'Production', vi.fn());
        expect(ssh.deleteServers).not.toHaveBeenCalled();
        expect(database.deleteServers).not.toHaveBeenCalled();
    });
});