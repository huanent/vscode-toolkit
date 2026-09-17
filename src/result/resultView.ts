import * as vscode from 'vscode';
import type { Result, ResultMessage } from './protocol';
import { getWebviewHtml } from '../webview';
import { TaskRunner } from './taskRunner';

export class ResultView implements vscode.WebviewViewProvider {
	static readonly viewType = 'vscode-toolkit.result';
	private view: vscode.WebviewView | undefined;
	private result: Result | undefined;
	private ready = false;
	readonly runner = new TaskRunner(() => this.postResult());
	private selectedId: string | undefined;

	get selectedResult(): Result | undefined { return this.result; }

	run(result: Result, execute: (signal: AbortSignal) => Promise<void>): Promise<void> {
		return this.runner.run(result, () => this.show(result), execute);
	}

	dispose(): void { this.runner.dispose(); }

	constructor(private readonly extensionUri: vscode.Uri) { }

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		this.ready = false;
		this.updateBadge();
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
		};
		view.webview.onDidReceiveMessage(message => {
			if (message?.type === 'selectTask' && typeof message.id === 'string') {
				const entry = this.runner.entries.get(message.id);
				if (entry) {
					this.selectedId = entry.task.id;
					this.result = entry.result;
					this.postResult();
				}
			}
			if (message?.type === 'cancelTask' && typeof message.id === 'string') this.runner.cancel(message.id);
			if (message?.type === 'deleteTask' && typeof message.id === 'string') {
				this.runner.remove(message.id);
				if (!this.selectedId || !this.runner.entries.has(this.selectedId)) {
					const entry = [...this.runner.entries.values()].at(-1);
					this.selectedId = entry?.task.id;
					this.result = entry?.result;
				}
				this.postResult();
			}
			if (message?.type === 'ready') {
				this.ready = true;
				this.postResult();
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

	async show(result: Result, exportable = false, cancel?: () => void): Promise<void> {
		this.result = result;
		this.selectedId = this.runner.add(result, cancel).task.id;
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
		this.runner.update(result);
	}

	private updateBadge(): void {
		if (!this.view) return;
		const active = [...this.runner.entries.values()].filter(entry => entry.task.state === 'running' || entry.task.state === 'stopping').length;
		this.view.badge = active ? { value: active, tooltip: `${active} running task${active === 1 ? '' : 's'}` } : undefined;
	}

	private postResult(): void {
		this.updateBadge();
		const exportable = this.result?.type === 'table' && this.result.data.kind === 'rows';
		void vscode.commands.executeCommand('setContext', 'vscode-toolkit.servers.mysqlSqlResultsExportable', exportable);
		if (this.ready && this.view?.visible) {
			void this.view.webview.postMessage({
				type: 'history', selectedId: this.selectedId,
				tasks: [...this.runner.entries.values()].map(entry => entry.task).reverse(),
			});
		}
		if (this.ready && this.result && this.view?.visible) {
			const message: ResultMessage = { type: 'result', result: this.result };
			void this.view.webview.postMessage(message);
		}
	}
}