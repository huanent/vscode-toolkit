import * as vscode from 'vscode';
import { openServerConnection, openServerForm } from './editors/serversEditor';
import { Server, ServerType } from './servers/server';
import { ServerCredentials, ServerStore } from './servers/serverStore';
import { handleMessage, ServerFormWebviewMessage } from './serverForm/serverFormPanel';
import { exportServer, importServers } from './servers/serverTransfer';
import { getWebviewHtml } from './webview';

export function registerManagementFeature(
	context: vscode.ExtensionContext,
	store: ServerStore,
	name: string,
	serverType: ServerType,
	icon: string,
): vscode.Disposable {
	let panel: vscode.WebviewPanel | undefined;
	let pendingForm: { server?: Server; duplicate?: boolean } | undefined;
	let requestForm: ((request: { server?: Server; duplicate?: boolean }) => Promise<void>) | undefined;
	const command = vscode.commands.registerCommand(`vscode-toolkit.open${name}`, async (request?: { server?: Server; duplicate?: boolean }) => {
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
		let form: { sessionId: number; server?: Server; duplicate: boolean; credentials: ServerCredentials; inProgress: boolean } | undefined;
		const openForm = async (request: { server?: Server; duplicate?: boolean }) => {
			if (form?.inProgress) return;
			const sessionId = ++sequence;
			const credentials = request.server ? await store.getCredentials(request.server.id) : {};
			if (sessionId !== sequence) return;
			form = { sessionId, server: request.server, duplicate: !!request.duplicate, credentials, inProgress: false };
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
						address: 'host' in server ? `${server.host}:${server.port}` : server.executablePath,
						kind:
							server.type === 'container'
								? server.runtime
								: server.type === 'mysql'
									? 'MySQL'
									: 'SSH',
					})),
			});
		const changes = store.onDidChange(() => void publish());
		const messages = current.webview.onDidReceiveMessage(
			async (message: { type?: string; id?: string; sessionId?: number; message?: ServerFormWebviewMessage }) => {
				try {
					if (serverType === 'ssh' && message.type === 'closeForm') {
						if (!form?.inProgress) { form = undefined; sequence++; }
						return;
					}
					if (serverType === 'ssh' && message.type === 'formMessage') {
						const active = form;
						if (!active || active.sessionId !== message.sessionId || !message.message) return;
						if (!['ready', 'save', 'selectPrivateKey', 'selectProxyPrivateKey'].includes(message.message.type)) return;
						await handleMessage(message.message, context, current, store, 'ssh', active.server,
							active.credentials, [], active.duplicate, active, () => {
								if (form === active) form = undefined;
								void current.webview.postMessage({ type: 'saved', sessionId: active.sessionId });
							}, active.sessionId);
						return;
					}
					if (message.type === 'ready' || message.type === 'refresh') {
						await publish();
						if (serverType === 'ssh' && message.type === 'ready') {
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
						if (serverType === 'ssh') await openForm({});
						else await openServerForm(serverType);
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
							if (serverType === 'ssh') await openForm({ server });
							else await openServerForm(serverType, server);
							break;
						case 'duplicate':
							if (serverType === 'ssh') await openForm({ server, duplicate: true });
							else await openServerForm(serverType, server, true);
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
			serverType === 'mysql' ? 'databaseManagement' : `${serverType}Management`,
			name,
		);
	});
	return vscode.Disposable.from(command, { dispose: () => panel?.dispose() });
}
