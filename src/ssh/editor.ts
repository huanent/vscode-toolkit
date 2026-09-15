import * as vscode from 'vscode';
import { Server } from './server';
import { ServerStore } from './serverStore';
import {
	createEditorUri,
	EditorDescriptor,
	parseEditorDescriptor,
	editorViewType,
} from './editorDescriptor';
import { configureSshTerminal } from './sshTerminal';

export function registerSshEditor(
	context: vscode.ExtensionContext,
	store: ServerStore,
): vscode.Disposable {
	const provider: vscode.CustomReadonlyEditorProvider = {
		openCustomDocument: uri => ({ uri, dispose() {} }),
		resolveCustomEditor: async (document, panel) => {
			const descriptor = parseEditorDescriptor(document.uri);
			const server = store.getServers().find(candidate => candidate.id === descriptor.serverId);
			if (descriptor.kind === 'serverForm') {
				if (descriptor.serverId && !server) throw new Error('The connection no longer exists.');
				await openServerForm('ssh', server, descriptor.duplicate);
				panel.dispose();
				return;
			}
			if (!server || server.type !== 'ssh') throw new Error('The connection no longer exists.');
			const credentials = await store.getCredentials(server.id);
			if (server.authType === 'privateKey' ? !credentials.privateKey : !credentials.password) {
				throw new Error('The SSH connection credentials are missing.');
			}
			configureSshTerminal(context, panel, server, credentials);
		},
	};
	return vscode.window.registerCustomEditorProvider(editorViewType, provider, {
		supportsMultipleEditorsPerDocument: true,
		webviewOptions: { retainContextWhenHidden: true },
	});
}

export function openServerForm(
	_serverType: string,
	server?: Server,
	duplicate = false,
): Thenable<unknown> {
	return vscode.commands.executeCommand('vscode-toolkit.openSSH', { server, duplicate });
}

export function openServerConnection(server: Server): Thenable<unknown> {
	return openEditor({ kind: 'sshTerminal', serverId: server.id });
}

function openEditor(descriptor: EditorDescriptor): Thenable<unknown> {
	return vscode.commands.executeCommand(
		'vscode.openWith',
		createEditorUri(descriptor),
		editorViewType,
		{
			preview: false,
			viewColumn: vscode.ViewColumn.Active,
		},
	);
}
