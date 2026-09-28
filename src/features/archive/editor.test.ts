import { readFileSync } from 'node:fs';
import * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import { archiveEditorViewType, registerArchiveEditor } from './editor';
import type { ArchiveTreeEntry } from './protocol';
import { readArchiveTree, validateArchiveUri } from './service';

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
	validateArchiveUri: vi.fn<(uri: vscode.Uri) => void>(),
	readArchiveTree: vi.fn<(uri: vscode.Uri) => Promise<ArchiveTreeEntry[]>>(async () => []),
}));

describe('Archive editor', () => {
	it('registers ZIP files as the default editor', () => {
		const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
		const editor = manifest.contributes.customEditors.find(
			(entry: { viewType: string }) => entry.viewType === archiveEditorViewType,
		);
		expect(editor.priority).toBe('default');
		expect(editor.selector.map((entry: { filenamePattern: string }) => entry.filenamePattern)).toEqual(['*.zip']);
	});

	it('delegates validation and loading to the archive service', async () => {
		registerArchiveEditor({ extensionUri: { fsPath: '/extension' } } as vscode.ExtensionContext);
		const registration = vi.mocked(vscode.window.registerCustomEditorProvider).mock.calls.at(-1)!;
		const provider = registration[1] as vscode.CustomReadonlyEditorProvider;
		expect(registration[0]).toBe(archiveEditorViewType);

		const uri = { scheme: 'file', path: '/sample.zip', fsPath: '/sample.zip' } as vscode.Uri;
		const document = await provider.openCustomDocument(
			uri,
			{} as vscode.CustomDocumentOpenContext,
			{} as vscode.CancellationToken,
		);
		expect(validateArchiveUri).toHaveBeenCalledWith(uri);

		let messageListener: ((message: { type?: string }) => Promise<void>) | undefined;
		const postMessage = vi.fn<(message: unknown) => Promise<boolean>>(async () => true);
		const panel = {
			webview: {
				onDidReceiveMessage: (listener: (message: { type?: string }) => Promise<void>) => {
					messageListener = listener;
					return { dispose: vi.fn<() => void>() };
				},
				postMessage,
			},
			onDidDispose: () => ({ dispose: vi.fn<() => void>() }),
		} as unknown as vscode.WebviewPanel;

		await provider.resolveCustomEditor(document, panel, {} as vscode.CancellationToken);
		await messageListener!({ type: 'ready' });

		expect(readArchiveTree).toHaveBeenCalledWith(uri);
		expect(postMessage).toHaveBeenCalledWith({ type: 'loaded', data: [] });
	});
});
