import * as vscode from 'vscode';
import {
	normalizePassword,
	parseServerForm,
	Server,
	ServerFormMessage,
	usesPrivateKey,
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
		existingServer && !duplicate ? `Edit ${existingServer.name} Server` : 'Add SSH Server';
	const credentials = existingServer ? await store.getCredentials(existingServer.id) : {};
	panel.title = title;
	panel.webview.options = {
		enableScripts: true,
		localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
	};
	panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, 'sshForm', title);
	const saveState = { inProgress: false };
	panel.webview.onDidReceiveMessage(
		(message: ServerFormWebviewMessage) =>
			handleMessage(
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
	credentials: ServerCredentials,
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
				credentials,
				groups: store.getGroups(),
				location: existingServer ? store.getLocation(existingServer.id) : '',
				locationLocked: false,
				workspaceFolders: vscode.workspace.isTrusted ? store.getWorkspaceFolders() : [],
			},
		});
		return;
	}
	if (message.type === 'selectPrivateKey' || message.type === 'selectProxyPrivateKey') {
		const selection = await vscode.window.showOpenDialog({
			canSelectMany: false,
			canSelectFiles: true,
			canSelectFolders: false,
			openLabel: 'Select',
			title: 'Select SSH Private Key',
		});
		if (!selection?.[0]) {
			return;
		}
		try {
			const contents = await vscode.workspace.fs.readFile(selection[0]);
			await postMessage({
				type:
					message.type === 'selectProxyPrivateKey'
						? 'proxyPrivateKeySelected'
						: 'privateKeySelected',
				contents: Buffer.from(contents).toString('utf8'),
			});
		} catch (error) {
			await postMessage({
				type: 'error',
				message: `Could not read the private key: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
		return;
	}
	if (message.type !== 'save' || saveState.inProgress) return;
	saveState.inProgress = true;
	const server = parseServerForm(message, 'ssh', duplicate ? undefined : existingServer?.id);
	const submitted = {
		password: normalizePassword(message.password),
		privateKey: normalizePassword(message.privateKey),
		passphrase: normalizePassword(message.passphrase),
		proxyPassword: normalizePassword(message.proxyPassword),
		proxyPrivateKey: normalizePassword(message.proxyPrivateKey),
		proxyPassphrase: normalizePassword(message.proxyPassphrase),
	};
	const nextCredentials: ServerCredentials = submitted;
	const ownsCredentials = true;
	const existingOwnsCredentials = Boolean(existingServer);
	const privateKey = server ? usesPrivateKey(server) : false;
	const hasStoredCredential = privateKey
		? Boolean(credentials.privateKey)
		: Boolean(credentials.password);
	const changed =
		!existingOwnsCredentials ||
		!existingServer ||
		(server && usesPrivateKey(server) !== usesPrivateKey(existingServer));
	const needsCredential = ownsCredentials && (changed || !hasStoredCredential);
	const hasCredential = privateKey
		? Boolean(nextCredentials.privateKey)
		: Boolean(nextCredentials.password);
	const proxy = server?.proxy;
	const needsProxyCredential =
		proxy &&
		(!existingServer?.proxy ||
			existingServer.proxy.authType !== proxy.authType ||
			(proxy.authType === 'privateKey'
				? !credentials.proxyPrivateKey
				: !credentials.proxyPassword));
	const proxyInvalid =
		needsProxyCredential &&
		!(proxy?.authType === 'privateKey' ? submitted.proxyPrivateKey : submitted.proxyPassword);
	if (!server || (needsCredential && !hasCredential) || proxyInvalid) {
		saveState.inProgress = false;
		await postMessage({ type: 'error', message: 'Please complete all required fields.' });
		return;
	}
	try {
		await store.saveServer(server, nextCredentials, typeof message.location === 'string' ? message.location : undefined);
		onSaved();
	} catch (error) {
		saveState.inProgress = false;
		await postMessage({
			type: 'error',
			message: `Could not save the server: ${error instanceof Error ? error.message : String(error)}`,
		});
	}
}
