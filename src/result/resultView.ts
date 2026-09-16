import * as vscode from 'vscode';
import type { Result, ResultMessage } from './protocol';
import { getWebviewHtml } from '../webview';

export class ResultView implements vscode.WebviewViewProvider {
	static readonly viewType = 'vscode-toolkit.result';
	private view: vscode.WebviewView | undefined;
	private result: Result | undefined;
	private ready = false;

	constructor(private readonly extensionUri: vscode.Uri) { }

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		this.ready = false;
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
		};
		view.webview.onDidReceiveMessage(message => {
			if (message?.type === 'ready') {
				this.ready = true;
				this.postResult();
			}
			if (message?.type === 'cancelWorkflow' && this.result?.type === 'workflow' && this.result.data.state === 'running') {
				void vscode.commands.executeCommand('vscode-toolkit.cancelWorkflow');
			}
		});
		view.webview.html = getWebviewHtml(view.webview, this.extensionUri, {
			entry: 'result',
			title: 'Result',
		});
		view.onDidChangeVisibility(() => {
			if (view.visible) this.postResult();
		});
		view.onDidDispose(() => {
			this.view = undefined;
			this.ready = false;
		});
	}

	async show(result: Result, exportable = false): Promise<void> {
		this.result = result;
		await vscode.commands.executeCommand('setContext', 'vscode-toolkit.servers.mysqlSqlResultsExportable', exportable);
		await vscode.commands.executeCommand('setContext', 'vscode-toolkit.httpResultVisible', true);
		if (this.view) {
			this.view.show(true);
			this.postResult();
		} else {
			await vscode.commands.executeCommand(`${ResultView.viewType}.focus`);
		}
	}

	update(result: Result): void {
		if (this.result !== result) return;
		this.postResult();
	}

	private postResult(): void {
		if (this.ready && this.result && this.view?.visible) {
			const message: ResultMessage = { type: 'result', result: this.result };
			void this.view.webview.postMessage(message);
		}
	}
}