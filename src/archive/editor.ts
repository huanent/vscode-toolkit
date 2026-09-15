import * as path from 'node:path';
import * as vscode from 'vscode';
import { getWebviewHtml } from '../webview';
import { readArchiveTree, validateArchiveUri } from './service';

export const archiveEditorViewType = 'vscode-toolkit.archiveEditor';

export function registerArchiveEditor(context: vscode.ExtensionContext): vscode.Disposable {
	return vscode.window.registerCustomEditorProvider(archiveEditorViewType, {
		openCustomDocument: (uri: vscode.Uri) => {
			validateArchiveUri(uri);
			return { uri, dispose() {} };
		},
		resolveCustomEditor: (document: vscode.CustomDocument, panel: vscode.WebviewPanel) => {
			const name = path.posix.basename(document.uri.path);
			panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')] };
			panel.iconPath = new vscode.ThemeIcon('file-zip');
			let disposed = false;
			let loading = false;
			const listener = panel.webview.onDidReceiveMessage(async message => {
				if (message?.type !== 'ready' || disposed || loading) return;
				loading = true;
				try {
					const data = await readArchiveTree(document.uri);
					if (!disposed) await panel.webview.postMessage({ type: 'loaded', data });
				} catch (error) {
					if (!disposed) await panel.webview.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
				} finally {
					loading = false;
				}
			});
			panel.onDidDispose(() => { disposed = true; listener.dispose(); });
			panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, {
				entry: 'archive', title: name, rootData: { name }, stylePolicy: 'inline-attributes',
			});
		},
	}, { supportsMultipleEditorsPerDocument: false, webviewOptions: { retainContextWhenHidden: true } });
}