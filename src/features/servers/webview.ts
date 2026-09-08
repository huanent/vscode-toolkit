import * as vscode from 'vscode';
import { getWebviewHtml as createWebviewHtml } from '../../webview';

export function getWebviewHtml(
	webview: vscode.Webview,
	extensionUri: vscode.Uri,
	entry: string,
	title: string,
): string {
	return createWebviewHtml(webview, extensionUri, {
		entry,
		styleEntry: entry === 'sshTerminal' ? entry : 'servers',
		additionalStyleEntries: entry === 'sshTerminal' ? ['servers'] : [],
		title,
		allowImages: true,
	});
}
