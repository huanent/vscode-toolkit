import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as vscode from 'vscode';
import { archiveEditorViewType, registerArchiveEditor } from './editor';
import { readArchiveTree } from './service';

vi.mock('vscode', () => ({
    window: { registerCustomEditorProvider: vi.fn() },
    Uri: { joinPath: () => ({ path: '/media' }) },
    ThemeIcon: class { },
}));
vi.mock('../webview', () => ({ getWebviewHtml: () => '<html></html>' }));
vi.mock('./service', () => ({ validateArchiveUri: vi.fn(), readArchiveTree: vi.fn(async () => []) }));

describe('Archive editor', () => {
    it('registers readable default suffix associations', () => {
        const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
        const editor = manifest.contributes.customEditors.find((entry: { viewType: string }) => entry.viewType === archiveEditorViewType);
        expect(editor.priority).toBe('default');
        expect(editor.selector.map((entry: { filenamePattern: string }) => entry.filenamePattern)).toEqual(['*.zip']);
    });
    it('loads files through the independent provider and cleans up on close', async () => {
        registerArchiveEditor({ extensionUri: { path: '/extension' } } as vscode.ExtensionContext);
        const provider = vi.mocked(vscode.window.registerCustomEditorProvider).mock.calls.at(-1)![1] as vscode.CustomReadonlyEditorProvider;
        const dispose = vi.fn();
        const receive = vi.fn<(callback: (message: unknown) => Promise<void>) => { dispose: typeof dispose }>(() => ({ dispose }));
        const onDidDispose = vi.fn<(callback: () => void) => void>();
        const postMessage = vi.fn();
        const uri = { scheme: 'file', path: '/sample.zip', fsPath: '/sample.zip' } as vscode.Uri;
        await provider.resolveCustomEditor({ uri, dispose() { } }, { webview: { onDidReceiveMessage: receive, postMessage }, onDidDispose } as unknown as vscode.WebviewPanel, {} as vscode.CancellationToken);
        await receive.mock.calls[0][0]({ type: 'ready' });
        expect(readArchiveTree).toHaveBeenCalledWith(uri);
        expect(postMessage).toHaveBeenCalledWith({ type: 'loaded', data: [] });
        onDidDispose.mock.calls[0][0]();
        expect(dispose).toHaveBeenCalledOnce();
    });
});