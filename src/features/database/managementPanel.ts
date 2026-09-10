import * as vscode from 'vscode';
import { dashboardFeaturePanel } from '../dashboard/panel';
import { openServerConnection } from './editor';
import { createFormSession } from '../dashboard/formSession';
import { ServerStore } from './serverStore';
import { handleMessage, ServerFormWebviewMessage } from './serverForm';
import { exportServer, importServers } from './serverTransfer';
export function registerManagementFeature(
	context: vscode.ExtensionContext,
	store: ServerStore,
): vscode.Disposable {
	const name = 'Database';
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
			const form = createFormSession(
				current,
				(server: ReturnType<ServerStore['getServers']>[number]) => store.getCredentials(server.id),
				{},
				(
					message: ServerFormWebviewMessage,
					server,
					credentials,
					duplicate,
					state,
					saved,
					sessionId,
				) =>
					handleMessage(
						message,
						context,
						current,
						store,
						server,
						credentials,
						duplicate,
						state,
						saved,
						sessionId,
					),
			);
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
					sessionId?: number;
					message?: ServerFormWebviewMessage;
				}) => {
					try {
						if (await form.receive(message)) return;
						if (message.type === 'ready' || message.type === 'refresh') {
							await publish();
							return;
						}
						if (message.type === 'add') {
							await form.open();
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
								await form.open(server);
								break;
							case 'duplicate':
								await form.open(server, true);
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
				form.dispose();
				changes.dispose();
				messages.dispose();
				panel = undefined;
			});
		},
	);
	return vscode.Disposable.from(command, { dispose: () => panel?.dispose() });
}
