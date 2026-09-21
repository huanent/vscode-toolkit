import * as vscode from 'vscode';
import { registerConnectionStore } from '../connection/management';
import { dashboardFeaturePanel } from '../dashboard/panel';
import { openServerConnection, openServerForm } from './editor';
import { ServerStore } from './serverStore';
import { exportServer, importServers } from './serverTransfer';
export function registerManagementFeature(
	context: vscode.ExtensionContext,
	store: ServerStore,
): vscode.Disposable {
	const name = 'Database';
	context.subscriptions.push(registerConnectionStore('database', store));
	const serverType = 'mysql';
	let panel: vscode.WebviewPanel | undefined;
	const command = vscode.commands.registerCommand(
		`vscode-toolkit.open${name}`,
		async (request?: { background?: boolean }) => {
			if (panel) {
				if (!request?.background) panel.reveal();
				return;
			}
			const current = dashboardFeaturePanel('database', request?.background);
			panel = current;
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
							address: `${server.host}:${server.port}`,
							kind: 'MySQL',
						})),
				});
			const changes = store.onDidChange(() => void publish());
			const messages = current.webview.onDidReceiveMessage(
				async (message: {
					type?: string;
					id?: string;
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
							case 'copyHost':
								await vscode.env.clipboard.writeText(server.host);
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
		},
	);
	return vscode.Disposable.from(command, { dispose: () => panel?.dispose() });
}
