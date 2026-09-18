import * as vscode from 'vscode';
import type { Result, ResultMessage } from './protocol';
import { getWebviewHtml } from '../webview';
import { TaskRunner, type TaskEntry } from './taskRunner';
import { ResultStorage } from './storage';

export class ResultView implements vscode.WebviewViewProvider {
	static readonly viewType = 'vscode-toolkit.result';
	private view: vscode.WebviewView | undefined;
	private result: Result | undefined;
	private ready = false;
	readonly runner = new TaskRunner(entry => { this.persist(entry); this.postResult(); });
	private selectedId: string | undefined;
	private syncTimer: ReturnType<typeof setInterval> | undefined;
	private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
	private refreshing: Promise<void> | undefined;
	private heartbeatPending: Promise<void> = Promise.resolve();
	private disposed = false;

	get selectedResult(): Result | undefined { return this.result; }

	run(result: Result, execute: (signal: AbortSignal) => Promise<void>): Promise<void> {
		return this.runner.run(result, () => this.show(result), execute);
	}

	dispose(): void {
		this.disposed = true;
		clearInterval(this.syncTimer);
		clearInterval(this.heartbeatTimer);
		this.runner.dispose();
		void this.heartbeatPending.then(() => this.storage?.endSession(this.runner.sessionId)).catch(() => { });
	}

	constructor(private readonly extensionUri: vscode.Uri, private readonly storage?: ResultStorage) { }

	static async create(context: vscode.ExtensionContext): Promise<ResultView> {
		try {
			const storage = await ResultStorage.create(context);
			const entries = await storage.load();
			const provider = new ResultView(context.extensionUri, storage);
			provider.runner.restore(entries, await storage.liveSessions());
			const latest = provider.runner.history[0];
			provider.selectedId = latest?.task.id;
			provider.result = latest?.result;
			await storage.heartbeat(provider.runner.sessionId);
			provider.heartbeatTimer = setInterval(() => {
				provider.heartbeatPending = storage.heartbeat(provider.runner.sessionId).catch(() => { });
			}, 10_000);
			provider.syncTimer = setInterval(() => {
				if (provider.view?.visible) void provider.refresh();
			}, 3_000);
			return provider;
		} catch (error) {
			void vscode.window.showErrorMessage(`Unable to load result history: ${String(error)}`);
			return new ResultView(context.extensionUri);
		}
	}

	private persist(entry: TaskEntry): void {
		if (entry.task.ownerSessionId !== this.runner.sessionId) return;
		void this.storage?.persist([entry]).catch(error => {
			void vscode.window.showErrorMessage(`Unable to save result history: ${String(error)}`);
		});
	}

	private refresh(): Promise<void> {
		if (!this.storage || this.disposed) {
			this.postResult();
			return Promise.resolve();
		}
		if (this.refreshing) return this.refreshing;
		const localSnapshots = new Map(this.runner.history
			.filter(entry => entry.task.ownerSessionId === this.runner.sessionId)
			.map(entry => [entry.task.id, JSON.stringify(entry)]));
		this.refreshing = Promise.all([this.storage.load(), this.storage.liveSessions()]).then(([entries, sessions]) => {
			if (this.disposed) return;
			for (const entry of this.runner.history) {
				if (entry.task.ownerSessionId === this.runner.sessionId && localSnapshots.get(entry.task.id) !== JSON.stringify(entry)) entries.push(entry);
			}
			this.runner.restore(entries, sessions);
			const selected = this.selectedId ? this.runner.entries.get(this.selectedId) : undefined;
			const entry = selected ?? this.runner.history[0];
			this.selectedId = entry?.task.id;
			this.result = entry?.result;
			this.postResult();
		}).catch(error => {
			console.warn('Unable to refresh result history:', error);
		}).finally(() => { this.refreshing = undefined; });
		return this.refreshing;
	}

	resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		this.ready = false;
		this.updateBadge();
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
		};
		view.webview.onDidReceiveMessage(message => {
			if (message?.type === 'refreshTasks') void this.refresh();
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
				if (this.runner.remove(message.id)) {
					void this.storage?.remove(message.id).catch(error => {
						void vscode.window.showErrorMessage(`Unable to delete result history: ${String(error)}`);
					});
				}
				if (!this.selectedId || !this.runner.entries.has(this.selectedId)) {
					const entry = this.runner.history[0];
					this.selectedId = entry?.task.id;
					this.result = entry?.result;
				}
				this.postResult();
			}
			if (message?.type === 'ready') {
				this.ready = true;
				this.postResult();
				void this.refresh();
			}
		});
		view.webview.html = getWebviewHtml(view.webview, this.extensionUri, {
			entry: 'result',
			title: 'Result',
		});
		view.onDidChangeVisibility(() => {
			if (view.visible) {
				this.postResult();
				void this.refresh();
			}
		});
		view.onDidDispose(() => {
			this.view = undefined;
			this.ready = false;
		});
	}

	async show(result: Result, exportable = false, cancel?: () => void): Promise<void> {
		this.result = result;
		const entry = this.runner.add(result, cancel);
		this.selectedId = entry.task.id;
		this.persist(entry);
		await vscode.commands.executeCommand('setContext', 'vscode-toolkit.servers.mysqlSqlResultsExportable', exportable);
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
				tasks: this.runner.history.map(entry => entry.task),
			});
		}
		if (this.ready && this.result && this.view?.visible) {
			const message: ResultMessage = { type: 'result', result: this.result };
			void this.view.webview.postMessage(message);
		}
	}
}