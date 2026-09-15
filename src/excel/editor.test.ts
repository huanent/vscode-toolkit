import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { readFileSync } from 'node:fs';
import { excelEditorViewType, registerExcelEditor } from './editor';
import { readSpreadsheet } from './service';

vi.mock('vscode', () => ({
    window: { registerCustomEditorProvider: vi.fn() },
    Uri: { joinPath: vi.fn(() => ({ path: '/media' })) },
    ThemeIcon: class { },
}));
vi.mock('../webview', () => ({ getWebviewHtml: () => '<html></html>' }));
vi.mock('./service', () => ({ readSpreadsheet: vi.fn() }));

function setupPanel() {
    registerExcelEditor({ extensionUri: { path: '/extension' } } as vscode.ExtensionContext);
    const registration = vi.mocked(vscode.window.registerCustomEditorProvider).mock.calls.at(-1)!;
    const provider = registration[1] as vscode.CustomReadonlyEditorProvider;
    const dispose = vi.fn();
    const panel = {
        webview: { onDidReceiveMessage: vi.fn<(listener: (message: unknown) => Promise<void>) => { dispose: typeof dispose }>(() => ({ dispose })), postMessage: vi.fn() },
        onDidDispose: vi.fn<(listener: () => void) => void>(),
    };
    const uri = { path: '/sample.xlsx' } as vscode.Uri;
    provider.resolveCustomEditor({ uri, dispose() { } }, panel as unknown as vscode.WebviewPanel, {} as vscode.CancellationToken);
    return { panel, uri, dispose, receive: panel.webview.onDidReceiveMessage.mock.calls[0] as unknown as [(message: unknown) => Promise<void>] };
}

describe('Excel file editor', () => {
    beforeEach(() => { vi.mocked(readSpreadsheet).mockReset(); });
    it('registers default XLSX and CSV suffix recognition including uppercase names', () => {
        const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
        const editor = manifest.contributes.customEditors.find((item: { viewType: string }) => item.viewType === excelEditorViewType);
        expect(editor.priority).toBe('default');
        expect(editor.selector).toEqual([
            { filenamePattern: '*.xlsx' }, { filenamePattern: '*.csv' }
        ]);
    });
    it.each(['xlsx', 'XLSX', 'csv', 'CSV'])('opens %s as a custom document using the original URI', async extension => {
        registerExcelEditor({} as vscode.ExtensionContext);
        const provider = vi.mocked(vscode.window.registerCustomEditorProvider).mock.calls.at(-1)![1] as vscode.CustomReadonlyEditorProvider;
        const uri = { path: `/sample.${extension}` } as vscode.Uri;
        const document = await provider.openCustomDocument(uri, { backupId: undefined, untitledDocumentData: undefined }, {} as vscode.CancellationToken);
        expect(document.uri).toBe(uri);
    });
    it('rejects unsupported XLS files', () => {
        registerExcelEditor({} as vscode.ExtensionContext);
        const provider = vi.mocked(vscode.window.registerCustomEditorProvider).mock.calls.at(-1)![1] as vscode.CustomReadonlyEditorProvider;
        expect(() => provider.openCustomDocument({ path: '/sample.xls' } as vscode.Uri, { backupId: undefined, untitledDocumentData: undefined }, {} as vscode.CancellationToken)).toThrow('Only XLSX and CSV');
    });
    it('loads the document when the webview is ready', async () => {
        const { panel, uri, receive } = setupPanel();
        vi.mocked(readSpreadsheet).mockResolvedValue([]);
        await receive[0]({ type: 'ready' });
        expect(readSpreadsheet).toHaveBeenCalledWith(uri);
        expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'loaded', data: [] });
    });
    it('reports parsing failures in the webview', async () => {
        const { panel, receive } = setupPanel();
        vi.mocked(readSpreadsheet).mockImplementation(async () => { throw new Error('Invalid workbook'); });
        await receive[0]({ type: 'ready' });
        expect(panel.webview.postMessage).toHaveBeenCalledWith({ type: 'error', message: 'Invalid workbook' });
    });
    it('disposes the listener and suppresses pending results after closing', async () => {
        const { panel, dispose, receive } = setupPanel();
        vi.mocked(readSpreadsheet).mockResolvedValue([]);
        const request = receive[0]({ type: 'ready' });
        panel.onDidDispose.mock.calls[0][0]();
        await request;
        expect(dispose).toHaveBeenCalledOnce();
        expect(panel.webview.postMessage).not.toHaveBeenCalled();
    });
});