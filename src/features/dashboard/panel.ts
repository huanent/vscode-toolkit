import * as vscode from 'vscode';
import { getWebviewHtml } from '../../webview';

export type DashboardTab = 'ssh' | 'workflow' | 'database' | 'container' | 'launchd';
let panel: vscode.WebviewView | undefined;
let context: vscode.ExtensionContext;
let activeTab: DashboardTab = 'workflow';
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
	launchd: 'openLaunchd',
};

export function registerDashboard(extensionContext: vscode.ExtensionContext): void {
	context = extensionContext;
	context.subscriptions.push(
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
		{
			dispose: () => {
				for (const editor of editors.values()) editor.dispose();
				for (const receiver of receivers.values()) receiver.dispose();
			},
		},
	);
}

async function focusDashboard(tab: DashboardTab = activeTab): Promise<void> {
	activeTab = tab;
	await vscode.commands.executeCommand('vscode-toolkit.dashboard.focus');
	panel?.show();
	await panel?.webview.postMessage({ type: 'dashboardTab', tab });
}

function configureDashboard(current: vscode.WebviewView): void {
	current.webview.options = {
		enableScripts: true,
		localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
	};
	const messages = current.webview.onDidReceiveMessage(async message => {
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
				isMac: process.platform === 'darwin',
			});
			for (const [channel, command] of Object.entries(commands)) {
				if (channel !== 'launchd' || process.platform === 'darwin')
					await vscode.commands.executeCommand(`vscode-toolkit.${command}`, { background: true });
			}
			await current.webview.postMessage({ type: 'dashboardConnected' });
		} else if (message.type === 'dashboardTab' && message.tab in commands) {
			activeTab = message.tab;
		} else if (
			message.type === 'dashboardNavigate' &&
			['openChat', 'openExplorer', 'openHttpClient'].includes(message.command)
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
						'launchdDetails',
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
		`${tab === 'ssh' ? 'SSH' : tab[0].toUpperCase() + tab.slice(1)} - Toolkit`,
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
		},
	);
	editor.iconPath = new vscode.ThemeIcon(tab === 'ssh' ? 'terminal' : 'tools');
	editors.set(tab, editor);
	const messages = editor.webview.onDidReceiveMessage(message => {
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
		entry: 'dashboardEditor',
		title: 'Toolkit',
		rootData: { tab },
	});
}
