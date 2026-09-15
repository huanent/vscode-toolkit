import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { readFileSync } from 'node:fs';
import { openSqliteEditor, registerSqliteEditor, sqliteEditorViewType } from './editor';

const mocks = vi.hoisted(() => ({ handleRequest: vi.fn(), dispose: vi.fn() }));
vi.mock('vscode', () => ({
    window: { registerCustomEditorProvider: vi.fn(), showErrorMessage: vi.fn() },
    commands: { executeCommand: vi.fn() },
    Uri: { joinPath: vi.fn(() => ({ path: '/media' })) },
    ThemeIcon: class { },
}));
vi.mock('../../webview', () => ({ getWebviewHtml: () => '<html></html>' }));
vi.mock('./service', () => ({
    SqliteSession: class {
        handleRequest = mocks.handleRequest;
        dispose = mocks.dispose;
    },
}));

describe('SQLite file editor', () => {
    it('registers as the default editor for all supported file extensions', () => {
        const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
        const contribution = manifest.contributes.customEditors.find(
            (editor: { viewType: string }) => editor.viewType === sqliteEditorViewType,
        );
        expect(contribution.priority).toBe('default');
        expect(contribution.selector).toEqual([
            { filenamePattern: '*.db' },
            { filenamePattern: '*.sqlite' },
            { filenamePattern: '*.sqlite3' },
        ]);
    });

    it('opens the original file URI with the SQLite editor', async () => {
        const uri = { path: '/sample.db' } as vscode.Uri;
        await openSqliteEditor(uri);
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('vscode.openWith', uri, sqliteEditorViewType);
    });

    it('routes messages to the session and disposes it when the editor closes', async () => {
        const context = { extensionUri: { path: '/extension' } } as vscode.ExtensionContext;
        registerSqliteEditor(context);
        const registration = vi.mocked(vscode.window.registerCustomEditorProvider).mock.calls.at(-1)!;
        expect(registration[0]).toBe(sqliteEditorViewType);
        expect(registration[2]?.supportsMultipleEditorsPerDocument).toBe(false);
        const provider = registration[1] as vscode.CustomReadonlyEditorProvider;
        const onDidDispose = vi.fn();
        const onDidReceiveMessage = vi.fn();
        const panel = { webview: { onDidReceiveMessage, postMessage: vi.fn() }, onDidDispose };
        await provider.resolveCustomEditor(
            { uri: { path: '/sample.db' }, dispose() { } } as vscode.CustomDocument,
            panel as unknown as vscode.WebviewPanel,
            {} as vscode.CancellationToken,
        );
        onDidReceiveMessage.mock.calls[0][0]({ type: 'ready' });
        await Promise.resolve();
        expect(mocks.handleRequest).toHaveBeenCalledWith({ type: 'ready' });
        onDidDispose.mock.calls[0][0]();
        expect(mocks.dispose).toHaveBeenCalledOnce();
    });
});