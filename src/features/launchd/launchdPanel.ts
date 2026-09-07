import * as vscode from 'vscode';
import { homedir } from 'node:os';
import { getWebviewHtml } from '../../webview';
import { LaunchAgentConfig, LaunchdService } from './launchdService';

type WebviewMessage =
	| { type: 'ready' }
	| { type: 'refresh' }
	| { type: 'save'; config: LaunchAgentConfig }
	| { type: 'start'; fileName: string; label: string }
	| { type: 'stop'; label: string }
	| { type: 'details'; label: string }
	| { type: 'remove'; fileName: string; label: string }
	| { type: 'openDirectory' };

export class LaunchdPanel {
	static readonly viewType = 'vscode-toolkit.launchd';
	private static currentPanel: LaunchdPanel | undefined;
	private readonly service = new LaunchdService();

	static show(extensionUri: vscode.Uri): void {
		if (process.platform !== 'darwin') {
			void vscode.window.showInformationMessage('LaunchAgents are only available on macOS.');
			return;
		}
		if (LaunchdPanel.currentPanel) {
			LaunchdPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			LaunchdPanel.viewType,
			'LaunchAgents',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
				retainContextWhenHidden: true,
			},
		);
		LaunchdPanel.currentPanel = new LaunchdPanel(panel, extensionUri);
	}

	private constructor(
		private readonly panel: vscode.WebviewPanel,
		extensionUri: vscode.Uri,
	) {
		panel.iconPath = new vscode.ThemeIcon('server-process');
		panel.webview.html = getWebviewHtml(panel.webview, extensionUri, {
			entry: 'launchd',
			title: 'LaunchAgents',
			allowImages: true,
		});
		panel.onDidDispose(() => {
			LaunchdPanel.currentPanel = undefined;
		});
		panel.webview.onDidReceiveMessage(message => this.handleMessage(message));
	}

	private async handleMessage(message: WebviewMessage): Promise<void> {
		try {
			switch (message.type) {
				case 'ready':
				case 'refresh':
					await this.sendAgents();
					break;
				case 'save':
					await this.service.save(message.config);
					await this.sendAgents('LaunchAgent saved.');
					break;
				case 'start':
					await this.service.start(message.fileName, message.label);
					await this.sendAgents('LaunchAgent started.');
					break;
				case 'stop':
					await this.service.stop(message.label);
					await this.sendAgents('LaunchAgent stopped.');
					break;
				case 'details':
					await this.panel.webview.postMessage({
						type: 'launchdDetails',
						details: await this.service.getDetails(message.label),
					});
					break;
				case 'remove':
					await this.service.remove(message.fileName, message.label);
					await this.sendAgents('LaunchAgent deleted.');
					break;
				case 'openDirectory':
					await vscode.env.openExternal(vscode.Uri.file(`${homedir()}/Library/LaunchAgents`));
					break;
			}
		} catch (error) {
			await this.panel.webview.postMessage({
				type: 'launchdError',
				message: error instanceof Error ? error.message : 'LaunchAgent operation failed.',
			});
		}
	}

	private async sendAgents(message?: string): Promise<void> {
		await this.panel.webview.postMessage({
			type: 'launchdAgents',
			agents: await this.service.list(),
			message,
		});
	}
}
