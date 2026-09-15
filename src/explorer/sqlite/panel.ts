import * as vscode from 'vscode';
import { getDisplayName } from '../shared/fileEntry';
import { getExplorerPreviewWebviewHtml } from '../webviewHtml';
import { SqliteSession } from './service';
import type { SqliteRequest } from './protocol';

export function openSqlitePanel(context: vscode.ExtensionContext, uri: vscode.Uri): void {
	const name = getDisplayName(uri);
	const panel = vscode.window.createWebviewPanel(
		'vscode-toolkit.explorerSqliteManager',
		name,
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
		},
	);
	panel.iconPath = new vscode.ThemeIcon('database');
	panel.webview.html = getExplorerPreviewWebviewHtml(
		panel.webview,
		context.extensionUri,
		'sqlite',
		name,
	);
	const session = new SqliteSession(uri, message => panel.webview.postMessage(message));
	let requestQueue = Promise.resolve();
	panel.onDidDispose(() => session.dispose());
	panel.webview.onDidReceiveMessage((message: SqliteRequest) => {
		requestQueue = requestQueue.then(async () => {
			try {
				await session.handleRequest(message);
			} catch (error) {
				const messageText = error instanceof Error ? error.message : String(error);
				void vscode.window.showErrorMessage(messageText);
				await panel.webview.postMessage({ type: 'error', message: messageText });
			}
		});
	});
}
