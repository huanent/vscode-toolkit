import * as vscode from 'vscode';
import { registerConnectionStore } from '../connection/management';
import { dashboardFeaturePanel } from '../dashboard/panel';
import { openServerConnection } from './editor';
import { Server } from './server';
import { ServerStore } from './serverStore';
import { createSshFormPanels } from './formPanels';
import { exportServer, importServers } from './serverTransfer';
export function registerManagementFeature(
	context: vscode.ExtensionContext,
	store: ServerStore,
): vscode.Disposable {
	const name = 'SSH';
	context.subscriptions.push(registerConnectionStore('ssh', store));
	const serverType = 'ssh';
	let panel: vscode.WebviewPanel | undefined;
	const forms = createSshFormPanels(context, store);
	const command = vscode.commands.registerCommand(
		`vscode-toolkit.open${name}`,
		async (request?: { server?: Server; duplicate?: boolean; background?: boolean }) => {
			const background = request?.background;
			if (background) request = undefined;
			if (request) {
				forms.open(request.server, request.duplicate);
				return;
			}
			if (panel) {
				if (!background) panel.reveal();
				return;
			}
			const current = dashboardFeaturePanel('ssh', background);
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
							kind: 'SSH',
							commandCount: server.commands.length,
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
							forms.open();
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
							case 'runScript':
								await vscode.commands.executeCommand('vscode-toolkit.servers.runSshCommand', server.id);
								break;
							case 'copyHost':
								await vscode.env.clipboard.writeText(server.host);
								break;
							case 'connect':
								await openServerConnection(server);
								break;
							case 'edit':
								forms.open(server);
								break;
							case 'duplicate':
								forms.open(server, true);
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
	return vscode.Disposable.from(command, forms, { dispose: () => panel?.dispose() });
}
