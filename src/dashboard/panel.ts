import * as vscode from 'vscode';
import { getWebviewHtml } from '../webview';
import { registerDashboardContextMenus } from './contextMenus';
import { credentialDashboard } from '../credential/dashboard';
import { loadConnectionOrder, manageConnection } from '../connection/management';
import { TempService } from '../temp/service';

export type DashboardTab = 'ssh' | 'workflow' | 'database' | 'container';
let panel: vscode.WebviewView | undefined;
let context: vscode.ExtensionContext;
let activeTab: 'workflow' | 'connection' | 'temp' = 'workflow';
let temp: TempService;
const channels = new Map<DashboardTab, vscode.WebviewPanel>();
const receivers = new Map<DashboardTab, vscode.EventEmitter<unknown>>();
const editors = new Map<DashboardTab, vscode.WebviewPanel>();
const editorRequests = new Map<DashboardTab, Record<string, unknown>>();
const editorReady = new Set<DashboardTab>();
const commands: Record<DashboardTab, string> = {
	ssh: 'openSSH',
	workflow: 'openWorkflow',
	database: 'openDatabase',
	container: 'openContainer',
};

export function registerDashboard(extensionContext: vscode.ExtensionContext): void {
	context = extensionContext;
	temp = new TempService(context);
	context.subscriptions.push(
		temp,
		vscode.window.registerWebviewViewProvider(
			'vscode-toolkit.dashboard',
			{
				resolveWebviewView(view) {
					panel = view;
					configureDashboard(view);
				},
			},
			{ webviewOptions: { retainContextWhenHidden: true } },
		),
		vscode.commands.registerCommand('vscode-toolkit.openDashboard', () => focusDashboard()),
		vscode.commands.registerCommand('vscode-toolkit.temp.newFile', () => temp.handle({ type: 'newFile' }, panel?.webview)),
		vscode.commands.registerCommand('vscode-toolkit.temp.selectFolder', (request?: { webviewSection?: unknown; tempPath?: unknown }) => {
			if (request?.webviewSection !== 'tempFile' || typeof request.tempPath !== 'string' || !panel) return;
			return temp.handle({ type: 'selectFolder', path: request.tempPath }, panel.webview);
		}),
		vscode.commands.registerCommand('vscode-toolkit.temp.delete', (request?: { webviewSection?: unknown; tempPath?: unknown }) => {
			if ((request?.webviewSection !== 'tempFile' && request?.webviewSection !== 'tempFolder') || typeof request.tempPath !== 'string' || !panel) return;
			return temp.handle({ type: 'delete', path: request.tempPath }, panel.webview);
		}),
		registerDashboardContextMenus((tab, request) => {
			if (tab === 'connection' || ['up', 'down'].includes(request.type)) {
				void manageConnection(context, tab, request.type, request.id, order => {
					void panel?.webview.postMessage({ channel: 'connection', type: 'order', order });
				}).catch(error => { void vscode.window.showErrorMessage(String(error)); });
			} else if (request.type === 'edit' || request.type === 'duplicate') openDashboardEditor(tab, request);
			else receivers.get(tab)?.fire(request);
		}),
		...(['edit', 'delete'] as const).map(action =>
			vscode.commands.registerCommand(`vscode-toolkit.${action}Workflow`, (request?: { workflowId?: unknown; workflowLocked?: unknown }) => {
				if (typeof request?.workflowId !== 'string' || request.workflowLocked === true) return;
				if (action === 'edit') openDashboardEditor('workflow', { type: 'openEditor', id: request.workflowId });
				else receivers.get('workflow')?.fire({ type: 'delete', id: request.workflowId });
			}),
		),
		{
			dispose: () => {
				for (const editor of editors.values()) editor.dispose();
				for (const receiver of receivers.values()) receiver.dispose();
			},
		},
	);
}

async function focusDashboard(tab: DashboardTab | 'connection' | 'temp' = activeTab): Promise<void> {
	activeTab = tab === 'workflow' || tab === 'temp' ? tab : 'connection';
	await vscode.commands.executeCommand('vscode-toolkit.dashboard.focus');
	panel?.show();
	await panel?.webview.postMessage({ type: 'dashboardTab', tab: activeTab });
}

function configureDashboard(current: vscode.WebviewView): void {
	current.webview.options = {
		enableScripts: true,
		localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
	};
	const messages = current.webview.onDidReceiveMessage(async message => {
		if (message.channel === 'temp') {
			await temp.handle(message, current.webview);
			return;
		}
		if (message.channel === 'connection') {
			if (message.type === 'ready') {
				await current.webview.postMessage({ channel: 'connection', type: 'order', order: await loadConnectionOrder(context) });
			} else if (message.type === 'refresh') {
				for (const tab of ['ssh', 'database', 'container'] as const) receivers.get(tab)?.fire(message);
			} else if (['add', 'import', 'exportAll'].includes(message.type)) {
				const selected = await vscode.window.showQuickPick([
					{ label: 'SSH', tab: 'ssh' as const },
					{ label: 'Database', tab: 'database' as const },
					{ label: 'Container', tab: 'container' as const },
				], { title: message.type === 'add' ? 'New connection' : 'Connection type', placeHolder: 'Select a connection type' });
				if (selected) {
					if (message.type === 'add') openDashboardEditor(selected.tab, message);
					else receivers.get(selected.tab)?.fire(message);
				}
			}
			return;
		}
		if (message.channel && Object.hasOwn(commands, message.channel)) {
			if (['add', 'edit', 'duplicate', 'openEditor', 'details'].includes(message.type)) {
				openDashboardEditor(message.channel, message);
			} else receivers.get(message.channel)?.fire(message);
			return;
		}
		if (message.type === 'dashboardReady') {
			await current.webview.postMessage({
				type: 'dashboardState',
				tab: activeTab,
			});
			for (const command of Object.values(commands)) {
				await vscode.commands.executeCommand(`vscode-toolkit.${command}`, { background: true });
			}
			await current.webview.postMessage({ type: 'dashboardConnected' });
		} else if (message.type === 'dashboardTab' && ['workflow', 'connection', 'temp'].includes(message.tab)) {
			activeTab = message.tab;
		} else if (
			message.type === 'dashboardNavigate' &&
			['openChat', 'openExplorer'].includes(message.command)
		) {
			await vscode.commands.executeCommand(`vscode-toolkit.${message.command}`);
		}
	});
	current.onDidDispose(() => {
		messages.dispose();
		panel = undefined;
	});
	current.webview.html = getWebviewHtml(current.webview, context.extensionUri, {
		entry: 'dashboard',
		title: 'Toolkit',
	});
}

export function dashboardFeaturePanel(tab: DashboardTab, background = false): vscode.WebviewPanel {
	if (!background) void focusDashboard(tab);
	const existing = channels.get(tab);
	if (existing) return existing;
	const receiver = new vscode.EventEmitter<unknown>();
	const disposed = new vscode.EventEmitter<void>();
	receivers.set(tab, receiver);
	const scoped = {
		set title(value: string) {
			const editor = editors.get(tab);
			if (editor) editor.title = value;
		},
		webview: {
			postMessage: async (message: { type?: string; sessionId?: number }) => {
				const response = { ...message, channel: tab };
				await editors.get(tab)?.webview.postMessage(response);
				if (
					![
						'initialize',
						'openForm',
						'saved',
						'formClosed',
						'privateKeySelected',
						'proxyPrivateKeySelected',
					].includes(message.type ?? '')
				) {
					await panel?.webview.postMessage(response);
				}
				return true;
			},
			onDidReceiveMessage: receiver.event,
		},
		reveal: () => {
			void focusDashboard(tab);
		},
		onDidDispose: disposed.event,
		dispose: () => {
			disposed.fire();
			disposed.dispose();
			receiver.dispose();
			channels.delete(tab);
			receivers.delete(tab);
		},
	} as unknown as vscode.WebviewPanel;
	channels.set(tab, scoped);
	return scoped;
}

export function openDashboardEditor(tab: DashboardTab, request: Record<string, unknown>): void {
	if (tab === 'database' || tab === 'ssh') {
		receivers.get(tab)?.fire(request);
		return;
	}
	const existing = editors.get(tab);
	if (existing) {
		existing.reveal();
		if (editorReady.has(tab)) void existing.webview.postMessage({ type: 'editorRequest', request });
		else editorRequests.set(tab, request);
		return;
	}
	editorRequests.set(tab, request);
	const editor = vscode.window.createWebviewPanel(
		`vscode-toolkit.${tab}.workspace`,
		`${tab[0].toUpperCase() + tab.slice(1)} - Toolkit`,
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
		},
	);
	const icons: Record<DashboardTab, string> = {
		workflow: 'circuit-board',
		ssh: 'terminal',
		database: 'database',
		container: 'symbol-method',
	};
	editor.iconPath = new vscode.ThemeIcon(icons[tab]);
	editors.set(tab, editor);
	const handleCredential = credentialDashboard(context);
	const messages = editor.webview.onDidReceiveMessage(message => {
		if (message.channel === 'credential') {
			void handleCredential(message, editor.webview);
			return;
		}
		if (message.type === 'editorReady') {
			editorReady.add(tab);
			void editor.webview.postMessage({ type: 'editorRequest', request: editorRequests.get(tab) });
		} else if (message.type === 'closeEditor') editor.dispose();
		else if (message.channel === tab) receivers.get(tab)?.fire(message);
	});
	editor.onDidDispose(() => {
		messages.dispose();
		editors.delete(tab);
		editorRequests.delete(tab);
		editorReady.delete(tab);
		receivers.get(tab)?.fire({ type: 'closeForm' });
	});
	editor.webview.html = getWebviewHtml(editor.webview, context.extensionUri, {
		entry: tab === 'workflow' ? 'workflowForm' : 'dashboardEditor',
		title: 'Toolkit',
		rootData: { tab },
	});
}
