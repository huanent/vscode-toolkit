import { posix } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { StorageLocation } from './storageLocation';
import { migrateConnections } from './connection/migration';

vi.mock('./connection/migration', () => ({ migrateConnections: vi.fn() }));
vi.mock('vscode', () => {
    const uri = (value: string) => ({ fsPath: value.replace('file://', ''), toString: () => value });
    return {
        Uri: { parse: uri, joinPath: (base: { fsPath: string }, ...parts: string[]) => uri(`file://${posix.join(base.fsPath, ...parts)}`) },
        workspace: {
            isTrusted: true,
            workspaceFolders: [{ name: 'project', uri: uri('file:///project') }],
            fs: { readDirectory: vi.fn().mockResolvedValue([]), createDirectory: vi.fn(), rename: vi.fn() },
        },
    };
});

describe('workspace storage locations', () => {
    beforeEach(() => { vi.mocked(vscode.workspace).isTrusted = true; });

    it.each(['workflow', 'ssh', 'database', 'container', 'connection'])('resolves %s under .toolkit and preserves global storage', feature => {
        const global = vscode.Uri.parse(`file:///global/${feature}`);
        const locations = new StorageLocation(global, feature);
        const directory = feature === 'workflow' ? 'workflow' : 'connection';
        expect(locations.resolve('file:///project').toString()).toBe(`file:///project/.toolkit/${directory}`);
        expect(locations.resolve('')).toBe(global);
        locations.select('item', 'file:///project');
        expect(locations.location('item')).toBe('file:///project');
        expect(locations.directory('item').toString()).toBe(`file:///project/.toolkit/${directory}`);
    });

    it('enumerates and migrates connections only at the new workspace root', async () => {
        const locations = new StorageLocation(vscode.Uri.parse('file:///global/connection'), 'ssh');
        await locations.entries();
        expect(migrateConnections).toHaveBeenCalledWith('/project/.toolkit');
        expect(vscode.workspace.fs.readDirectory).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/project/.toolkit/connection' }));
        expect(migrateConnections).not.toHaveBeenCalledWith('/project/.vscode/toolkit');
    });

    it('moves workflows to the new workspace directory', async () => {
        const locations = new StorageLocation(vscode.Uri.parse('file:///global/workflow'), 'workflow');
        await locations.move('item', 'item.json', 'file:///project');
        expect(vscode.workspace.fs.rename).toHaveBeenCalledWith(
            expect.objectContaining({ fsPath: '/global/workflow/item.json' }),
            expect.objectContaining({ fsPath: '/project/.toolkit/workflow/item.json' }),
            { overwrite: false },
        );
        expect(locations.location('item')).toBe('file:///project');
    });

    it('retains trust and open-workspace restrictions', async () => {
        const locations = new StorageLocation(vscode.Uri.parse('file:///global/workflow'), 'workflow');
        expect(() => locations.resolve('file:///other')).toThrow('open workspace');
        vi.mocked(vscode.workspace).isTrusted = false;
        expect(() => locations.resolve('file:///project')).toThrow('Trust');
        await locations.entries();
        expect(vscode.workspace.fs.readDirectory).toHaveBeenCalledTimes(1);
        expect(vscode.workspace.fs.readDirectory).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/global/workflow' }));
    });
});