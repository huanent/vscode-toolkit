import { credentialDashboard } from '../credential/dashboard';
import { resolveFormCredentials } from '../credential/connectionCredentials';
import * as vscode from 'vscode';
import { CredentialStore } from '../credential/store';
import { getStorageUri } from '../storagePath';
import {
	parseServerForm,
	Server,
	ServerFormMessage,
} from './server';
import { ServerCredentials, ServerStore } from './serverStore';
import { getWebviewHtml } from './webview';

export type ServerFormWebviewMessage = ServerFormMessage | { type: 'ready' };

export async function configureServerForm(
	context: vscode.ExtensionContext,
	panel: vscode.WebviewPanel,
	store: ServerStore,
	existingServer?: Server,
	duplicate = false,
): Promise<void> {
	const title =
		existingServer && !duplicate ? `Edit ${existingServer.name}` : 'New SSH';
	const credentials = {};
	panel.title = title;
	panel.webview.options = {
		enableScripts: true,
		localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
	};
	panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, 'sshForm', title);
	const saveState = { inProgress: false };
	const handleCredential = credentialDashboard(context);
	panel.webview.onDidReceiveMessage(
		(message: ServerFormWebviewMessage & { channel?: string }) =>
			message.channel === 'credential' ? handleCredential({ ...message }, panel.webview) : handleMessage(
				message,
				context,
				panel,
				store,
				existingServer,
				credentials,
				duplicate,
				saveState,
			),
		undefined,
		context.subscriptions,
	);
}

export async function handleMessage(
	message: ServerFormWebviewMessage,
	_context: vscode.ExtensionContext,
	panel: vscode.WebviewPanel,
	store: ServerStore,
	existingServer: Server | undefined,
	_credentials: ServerCredentials,
	duplicate: boolean,
	saveState: { inProgress: boolean },
	onSaved: () => void = () => panel.dispose(),
	sessionId?: number,
): Promise<void> {
	const postMessage = (response: object) => panel.webview.postMessage({ ...response, sessionId });
	if (message.type === 'ready') {
		await postMessage({
			type: 'initialize',
			model: {
				serverType: 'ssh',
				server:
					duplicate && existingServer && 'host' in existingServer
						? { ...existingServer, host: '' }
						: existingServer,
				credentials: {},
				groups: store.getGroups(),
				location: existingServer ? store.getLocation(existingServer.id) : '',
				locationLocked: false,
				workspaceFolders: vscode.workspace.isTrusted ? store.getWorkspaceFolders() : [],
			},
		});
		return;
	}
	if (message.type !== 'save' || saveState.inProgress) return;
	saveState.inProgress = true;
	try {
		const resolved = await resolveFormCredentials(new CredentialStore(getStorageUri(_context, 'credential').fsPath), { ...message }, 'ssh');
		const server = parseServerForm(resolved as unknown as ServerFormMessage, 'ssh', duplicate ? undefined : existingServer?.id);
		if (!server) throw new Error('Please complete all required fields.');
		await store.saveServer(server, typeof message.location === 'string' ? message.location : undefined);
		onSaved();
	} catch (error) {
		saveState.inProgress = false;
		await postMessage({
			type: 'error',
			message: `Could not save the server: ${error instanceof Error ? error.message : String(error)}`,
		});
	}
}
