import { readFileSync } from 'node:fs';
import * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import { excelEditorViewType, registerExcelEditor } from './editor';
import type { SpreadsheetSheet } from './protocol';
import { readSpreadsheet, validateSpreadsheetUri } from './service';

vi.mock('vscode', () => ({
	window: {
		registerCustomEditorProvider: vi.fn<(...args: unknown[]) => { dispose: () => void }>(() => ({
			dispose: vi.fn<() => void>(),
		})),
	},
	Uri: { joinPath: vi.fn<(...args: unknown[]) => vscode.Uri>(() => ({ fsPath: '/extension/dist' }) as vscode.Uri) },
	ThemeIcon: class {},
}));
vi.mock('@/host/webview-html', () => ({ getWebviewHtml: () => '<html></html>' }));
vi.mock('./service', () => ({
	validateSpreadsheetUri: vi.fn<(uri: vscode.Uri) => void>(),
	readSpreadsheet: vi.fn<(uri: vscode.Uri) => Promise<SpreadsheetSheet[]>>(async () => []),
}));

describe('Excel editor', () => {
	it('registers XLSX and CSV files as the default editor', () => {
		const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
		const editor = manifest.contributes.customEditors.find(
			(entry: { viewType: string }) => entry.viewType === excelEditorViewType,
		);
		expect(editor.priority).toBe('default');
		expect(editor.selector.map((entry: { filenamePattern: string }) => entry.filenamePattern)).toEqual([
			'*.xlsx',
			'*.csv',
		]);
	});

	it('delegates document validation and loading to the spreadsheet service', async () => {
		registerExcelEditor({ extensionUri: { fsPath: '/extension' } } as vscode.ExtensionContext);
		const registration = vi.mocked(vscode.window.registerCustomEditorProvider).mock.calls.at(-1)!;
		const provider = registration[1] as vscode.CustomReadonlyEditorProvider;
		const uri = { scheme: 'file', path: '/sample.xlsx', fsPath: '/sample.xlsx' } as vscode.Uri;
		const document = await provider.openCustomDocument(
			uri,
			{} as vscode.CustomDocumentOpenContext,
			{} as vscode.CancellationToken,
		);
		expect(registration[0]).toBe(excelEditorViewType);
		expect(validateSpreadsheetUri).toHaveBeenCalledWith(uri);

		let messageListener: ((message: { type?: string }) => Promise<void>) | undefined;
		const postMessage = vi.fn<() => Promise<boolean>>(async () => true);
		const panel = {
			webview: {
				onDidReceiveMessage: (listener: (message: { type?: string }) => Promise<void>) => {
					messageListener = listener;
					return { dispose: vi.fn<() => void>() };
				},
				postMessage,
			},
			onDidDispose: vi.fn<(listener: () => void) => vscode.Disposable>(() => ({
				dispose: vi.fn<() => void>(),
			})),
		} as unknown as vscode.WebviewPanel;

		await provider.resolveCustomEditor(document, panel, {} as vscode.CancellationToken);
		await messageListener!({ type: 'ready' });
		expect(readSpreadsheet).toHaveBeenCalledWith(uri);
		expect(postMessage).toHaveBeenCalledWith({ type: 'loaded', data: [] });
	});
});
