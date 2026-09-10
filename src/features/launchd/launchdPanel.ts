import * as vscode from 'vscode';
import { dashboardFeaturePanel, openDashboardEditor } from '../dashboard/panel';
import { homedir } from 'node:os';
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

	static show(extensionUri: vscode.Uri, background = false): void {
		if (process.platform !== 'darwin') {
			void vscode.window.showInformationMessage('Launchd is only available on macOS.');
			return;
		}
		if (LaunchdPanel.currentPanel) {
			if (!background) openDashboardEditor('launchd', {});
			return;
		}

		const panel = dashboardFeaturePanel('launchd', true);
		LaunchdPanel.currentPanel = new LaunchdPanel(panel);
		if (!background) openDashboardEditor('launchd', {});
	}

	private constructor(private readonly panel: vscode.WebviewPanel) {
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
