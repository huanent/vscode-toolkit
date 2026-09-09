import * as vscode from 'vscode';
import { openServerConnection, openServerForm } from './editor';
import { ServerStore } from './serverStore';
import { ServerFormWebviewMessage } from './serverForm';
import { exportServer, importServers } from './serverTransfer';
import { getWebviewHtml } from './webview';
export function registerManagementFeature(
	context: vscode.ExtensionContext,
	store: ServerStore,
): vscode.Disposable {
	const name = 'Container';
	const serverType = 'container';
	const icon = 'package';
	let panel: vscode.WebviewPanel | undefined;
	const command = vscode.commands.registerCommand(`vscode-toolkit.open${name}`, async () => {
		if (panel) {
			panel.reveal();
			return;
		}
		const current = vscode.window.createWebviewPanel(
			`vscode-toolkit.${name.toLowerCase()}.management`,
			name,
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
			},
		);
		panel = current;
		current.iconPath = new vscode.ThemeIcon(icon);
		const publish = () =>
			current.webview.postMessage({
				type: 'state',
				name,
				servers: store
					.getServers()
					.filter(server => server.type === serverType)
					.map(server => ({
						id: server.id,
						name: server.name,
						group: server.group,
						address: 'host' in server ? `${server.host}:${server.port}` : server.executablePath,
						kind: server.runtime,
					})),
			});
		const changes = store.onDidChange(() => void publish());
		const messages = current.webview.onDidReceiveMessage(
			async (message: {
				type?: string;
				id?: string;
				sessionId?: number;
				message?: ServerFormWebviewMessage;
			}) => {
				try {
					if (message.type === 'ready' || message.type === 'refresh') {
						await publish();
						return;
					}
					if (message.type === 'add') {
						await openServerForm(serverType);
						return;
					}
					if (message.type === 'import') {
						await importServers(store, serverType);
						return;
					}
					const servers = store.getServers().filter(server => server.type === serverType);
					if (message.type === 'exportAll') {
						await exportServer(store, servers);
						return;
					}
					const server = servers.find(candidate => candidate.id === message.id);
					if (!server) {
						return;
					}
					switch (message.type) {
						case 'up':
							await store.moveServer(server.id, 'up');
							break;
						case 'down':
							await store.moveServer(server.id, 'down');
							break;
						case 'connect':
							await openServerConnection(server);
							break;
						case 'edit':
							await openServerForm(serverType, server);
							break;
						case 'duplicate':
							await openServerForm(serverType, server, true);
							break;
						case 'export':
							await exportServer(store, [server]);
							break;
						case 'delete':
							if (
								(await vscode.window.showWarningMessage(
									`Delete connection "${server.name}"?`,
									{ modal: true },
									'Delete',
								)) === 'Delete'
							) {
								await store.deleteServer(server.id);
							}
							break;
					}
				} catch (error) {
					void vscode.window.showErrorMessage(
						error instanceof Error ? error.message : String(error),
					);
				}
			},
		);
		current.onDidDispose(() => {
			changes.dispose();
			messages.dispose();
			panel = undefined;
		});
		current.webview.html = getWebviewHtml(
			current.webview,
			context.extensionUri,
			'containerManagement',
			name,
		);
	});
	return vscode.Disposable.from(command, { dispose: () => panel?.dispose() });
}
