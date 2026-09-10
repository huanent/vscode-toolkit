import * as vscode from 'vscode';
import { getWebviewHtml } from '../../webview';

export type DashboardTab = 'ssh' | 'workflow' | 'database' | 'container' | 'launchd';
let panel: vscode.WebviewPanel | undefined;
let context: vscode.ExtensionContext;
let activeTab: DashboardTab = 'ssh';
const channels = new Map<DashboardTab, vscode.WebviewPanel>();
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
		vscode.commands.registerCommand('vscode-toolkit.openDashboard', () => showDashboard()),
		{
			dispose: () => panel?.dispose(),
		},
	);
}

function showDashboard(tab: DashboardTab = activeTab): vscode.WebviewPanel {
	activeTab = tab;
	if (panel) {
		panel.reveal();
		void panel.webview.postMessage({ type: 'dashboardTab', tab });
		return panel;
	}
	const current = vscode.window.createWebviewPanel(
		'vscode-toolkit.dashboard',
		'Dashboard',
		vscode.ViewColumn.Active,
		{
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
		},
	);
	panel = current;
	current.iconPath = new vscode.ThemeIcon('dashboard');
	const messages = current.webview.onDidReceiveMessage(async message => {
		if (message.channel) return;
		if (message.type === 'dashboardReady') {
			await current.webview.postMessage({
				type: 'dashboardState',
				tab: activeTab,
				favorites: context.globalState.get('toolkit.dashboard.favorites', []),
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
		} else if (message.type === 'dashboardFavorites' && Array.isArray(message.favorites)) {
			await context.globalState.update(
				'toolkit.dashboard.favorites',
				message.favorites
					.filter(
						(item: { tab?: string; id?: string }) =>
							item && typeof item.id === 'string' && item.tab && item.tab in commands,
					)
					.map((item: { tab: string; id: string }) => ({ tab: item.tab, id: item.id })),
			);
		}
	});
	current.onDidDispose(() => {
		messages.dispose();
		channels.clear();
		panel = undefined;
	});
	current.webview.html = getWebviewHtml(current.webview, context.extensionUri, {
		entry: 'dashboard',
		title: 'Dashboard',
	});
	return current;
}

export function dashboardFeaturePanel(tab: DashboardTab, background = false): vscode.WebviewPanel {
	const current = background && panel ? panel : showDashboard(tab);
	const existing = channels.get(tab);
	if (existing) return existing;
	const webview = new Proxy(current.webview, {
		get(target, property) {
			if (property === 'postMessage')
				return (message: object) => target.postMessage({ ...message, channel: tab });
			if (property === 'onDidReceiveMessage')
				return (listener: (message: unknown) => unknown) =>
					target.onDidReceiveMessage(message => {
						if (message.channel === tab) listener(message);
					});
			const value = Reflect.get(target, property);
			return typeof value === 'function' ? value.bind(target) : value;
		},
		set(target, property, value) {
			return property === 'html' || Reflect.set(target, property, value);
		},
	});
	const scoped = new Proxy(current, {
		get(target, property) {
			if (property === 'webview') return webview;
			if (property === 'reveal') return () => showDashboard(tab);
			const value = Reflect.get(target, property);
			return typeof value === 'function' ? value.bind(target) : value;
		},
		set(target, property, value) {
			return (
				property === 'iconPath' || property === 'title' || Reflect.set(target, property, value)
			);
		},
	});
	channels.set(tab, scoped);
	return scoped;
}
