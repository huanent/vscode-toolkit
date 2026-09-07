import * as vscode from 'vscode';
import { getExplorerPreviewWebviewHtml } from '../webviewHtml';

export interface PreviewPanelOptions<T> {
	viewType: string;
	title: string;
	icon: string;
	entryPoint: string;
	load: () => Promise<T>;
}

export async function openPreviewPanel<T>(
	context: vscode.ExtensionContext,
	options: PreviewPanelOptions<T>,
): Promise<void> {
	const panel = vscode.window.createWebviewPanel(
		options.viewType,
		options.title,
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
		},
	);
	panel.iconPath = new vscode.ThemeIcon(options.icon);
	let disposed = false;
	const disposeDisposable = panel.onDidDispose(() => (disposed = true));
	const ready = waitForReady(panel);
	panel.webview.html = getExplorerPreviewWebviewHtml(
		panel.webview,
		context.extensionUri,
		options.entryPoint,
		options.title,
	);

	try {
		if (!(await ready)) return;
		await panel.webview.postMessage({ type: 'loaded', data: await options.load() });
	} catch (error) {
		if (disposed) return;
		await panel.webview.postMessage({
			type: 'error',
			message: error instanceof Error ? error.message : String(error),
		});
		throw error;
	} finally {
		disposeDisposable.dispose();
	}
}

function waitForReady(panel: vscode.WebviewPanel): Promise<boolean> {
	return new Promise(resolve => {
		const messageDisposable = panel.webview.onDidReceiveMessage(message => {
			if (message?.type !== 'ready') return;
			messageDisposable.dispose();
			disposeDisposable.dispose();
			resolve(true);
		});
		const disposeDisposable = panel.onDidDispose(() => {
			messageDisposable.dispose();
			resolve(false);
		});
	});
}
