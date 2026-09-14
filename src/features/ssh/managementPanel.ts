import * as vscode from 'vscode';
import { dashboardFeaturePanel, openDashboardEditor } from '../dashboard/panel';
import { openServerConnection } from './editor';
import { Server } from './server';
import { ServerCredentials, ServerStore } from './serverStore';
import { handleMessage, ServerFormWebviewMessage } from './serverForm';
import { exportServer, importServers } from './serverTransfer';
export function registerManagementFeature(
	context: vscode.ExtensionContext,
	store: ServerStore,
): vscode.Disposable {
	const name = 'SSH';
	const serverType = 'ssh';
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
		async (request?: { server?: Server; duplicate?: boolean; background?: boolean }) => {
			const background = request?.background;
			if (background) request = undefined;
			if (panel) {
				if (!background) panel.reveal();
				if (request) {
					if (requestForm) await requestForm(request);
					else pendingForm = request;
				}
				return;
			}
			pendingForm = request;
			const current = dashboardFeaturePanel('ssh', background);
			panel = current;
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
				current.title = request.server && !request.duplicate ? `Edit ${request.server.name}` : 'New SSH';
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
							address: `${server.username}@${server.host}:${server.port}`,
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
								await current.webview.postMessage({ type: 'formClosed' });
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
								requestForm = async request => {
									pendingForm = request;
									openDashboardEditor('ssh', { type: 'openRequestedForm' });
								};
								if (pendingForm) {
									const request = pendingForm;
									pendingForm = undefined;
									await requestForm(request);
								}
							}
							return;
						}
						if (message.type === 'add') {
							await openForm({});
							return;
						}
						if (message.type === 'openRequestedForm') {
							await openForm(pendingForm ?? {});
							pendingForm = undefined;
							return;
						}
						if (message.type === 'import') {
							await importServers(store, serverType);
							return;
						}
						const servers = store.getServers().filter(server => server.type === serverType);
						if (['groupUp', 'groupDown', 'groupDelete', 'groupRename'].includes(message.type ?? '')) {
							const group = message.id;
							if (!group) return;
							const members = servers.filter(connection => connection.group.trim() === group);
							if (!members.length) return;
							if (message.type === 'groupUp' || message.type === 'groupDown') {
								await store.moveGroup(group, message.type === 'groupUp' ? 'up' : 'down');
							} else if (message.type === 'groupRename') {
								const name = await vscode.window.showInputBox({
									title: 'Rename connection group',
									value: group,
									validateInput: value => !value.trim() ? 'Enter a group name.' :
										value.trim() !== group && servers.some(connection => connection.group.trim() === value.trim())
											? 'A group with this name already exists.' : undefined,
								});
								if (name?.trim() && name.trim() !== group) await store.renameGroup(group, name.trim());
							} else if (await vscode.window.showWarningMessage(
								`Delete group "${group}" and its ${members.length} connections?`,
								{ modal: true }, 'Delete',
							) === 'Delete') {
								await store.deleteServers(members.map(connection => connection.id));
							}
							return;
						}
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
		},
	);
	return vscode.Disposable.from(command, { dispose: () => panel?.dispose() });
}
