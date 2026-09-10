import * as vscode from 'vscode';
import { getWebviewHtml } from '../../webview';
import type { ExplorerViewState, FolderEntry } from './protocol';

export function getExplorerWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	rootUri: vscode.Uri,
	title: string,
	initialViewState: ExplorerViewState,
	initialEntries: FolderEntry[],
): string {
	return getWebviewHtml(webview, extensionUri, {
		entry: 'explorer',
		styleEntry: 'explorer',
		title,
		useStyleNonce: true,
		rootData: {
			rootUri: rootUri.toString(),
			currentUri: initialViewState.currentUri,
			history: JSON.stringify(initialViewState.history),
			entries: JSON.stringify(initialEntries),
		},
	});
}

export function getExplorerPreviewWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	entry: string,
	title: string,
): string {
	return getWebviewHtml(webview, extensionUri, {
		entry,
		styleEntry: 'explorer',
		title,
		useStyleNonce: true,
		rootData: { name: title },
	});
}
