import * as vscode from 'vscode';
import { openServerConnection } from './editor';
import { Server } from './server';
import { ServerCredentials, ServerStore } from './serverStore';
import { handleMessage, ServerFormWebviewMessage } from './serverForm';
import { exportServer, importServers } from './serverTransfer';
import { getWebviewHtml } from './webview';
export function registerManagementFeature(
	context: vscode.ExtensionContext,
	store: ServerStore,
): vscode.Disposable {
	const name = 'SSH';
	const serverType = 'ssh';
	const icon = 'terminal';
	let panel: vscode.WebviewPanel | undefined;
	let pendingForm:
		| {
				server?: Server;
				duplicate?: boolean;
		  }
		| undefined;
	let requestForm:
		| ((request: { server?: Server; duplicate?: boolean }) => Promise<void>)
		| undefined;
	const command = vscode.commands.registerCommand(
		`vscode-toolkit.open${name}`,
		async (request?: { server?: Server; duplicate?: boolean }) => {
			if (panel) {
				panel.reveal();
				if (request) {
					if (requestForm) await requestForm(request);
					else pendingForm = request;
				}
				return;
			}
			pendingForm = request;
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
			let sequence = 0;
			let form:
				| {
						sessionId: number;
						server?: Server;
						duplicate: boolean;
						credentials: ServerCredentials;
						inProgress: boolean;
				  }
				| undefined;
			const openForm = async (request: { server?: Server; duplicate?: boolean }) => {
				if (form?.inProgress) return;
				const sessionId = ++sequence;
				const credentials = request.server ? await store.getCredentials(request.server.id) : {};
				if (sessionId !== sequence) return;
				form = {
					sessionId,
					server: request.server,
					duplicate: !!request.duplicate,
					credentials,
					inProgress: false,
				};
				await current.webview.postMessage({ type: 'openForm', sessionId });
			};
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
						if (message.type === 'closeForm') {
							if (!form?.inProgress) {
								form = undefined;
								sequence++;
							}
							return;
						}
						if (message.type === 'formMessage') {
							const active = form;
							if (!active || active.sessionId !== message.sessionId || !message.message) return;
							if (
								!['ready', 'save', 'selectPrivateKey', 'selectProxyPrivateKey'].includes(
									message.message.type,
								)
							)
								return;
							await handleMessage(
								message.message,
								context,
								current,
								store,
								active.server,
								active.credentials,
								active.duplicate,
								active,
								() => {
									if (form === active) form = undefined;
									void current.webview.postMessage({ type: 'saved', sessionId: active.sessionId });
								},
								active.sessionId,
							);
							return;
						}
						if (message.type === 'ready' || message.type === 'refresh') {
							await publish();
							if (message.type === 'ready') {
								requestForm = openForm;
								if (pendingForm) {
									const request = pendingForm;
									pendingForm = undefined;
									await openForm(request);
								}
							}
							return;
						}
						if (message.type === 'add') {
							await openForm({});
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
								await openForm({ server });
								break;
							case 'duplicate':
								await openForm({ server, duplicate: true });
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
				requestForm = undefined;
				pendingForm = undefined;
				sequence++;
			});
			current.webview.html = getWebviewHtml(
				current.webview,
				context.extensionUri,
				'sshManagement',
				name,
			);
		},
	);
	return vscode.Disposable.from(command, { dispose: () => panel?.dispose() });
}
