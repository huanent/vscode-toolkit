import * as vscode from 'vscode';
import * as path from 'node:path';
import { getWebviewHtml } from '../../webview';
import { SqliteSession } from './service';
import type { SqliteRequest } from './protocol';

export const sqliteEditorViewType = 'vscode-toolkit.database.sqliteEditor';

export function registerSqliteEditor(context: vscode.ExtensionContext): vscode.Disposable {
	return vscode.window.registerCustomEditorProvider(sqliteEditorViewType, {
		openCustomDocument: (uri: vscode.Uri) => ({ uri, dispose() { } }),
		resolveCustomEditor: (document: vscode.CustomDocument, panel: vscode.WebviewPanel) => {
			configureSqlitePanel(context, document.uri, panel);
		},
	}, {
		supportsMultipleEditorsPerDocument: false,
		webviewOptions: { retainContextWhenHidden: true },
	});
}

export function openSqliteEditor(uri: vscode.Uri): Thenable<unknown> {
	return vscode.commands.executeCommand('vscode.openWith', uri, sqliteEditorViewType);
}

function configureSqlitePanel(context: vscode.ExtensionContext, uri: vscode.Uri, panel: vscode.WebviewPanel): void {
	const name = path.posix.basename(uri.path);
	panel.webview.options = {
		enableScripts: true,
		localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
	};
	panel.iconPath = new vscode.ThemeIcon('database');
	panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, {
		entry: 'sqlite',
		styleEntry: 'global',
		title: name,
		rootData: { name },
	});
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
