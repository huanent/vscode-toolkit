import * as vscode from 'vscode';
import { Server } from './server';
import { ServerStore } from './serverStore';
import { configureServerForm } from './serverForm';
import {
	createEditorUri,
	EditorDescriptor,
	parseEditorDescriptor,
	editorViewType,
} from './editorDescriptor';
import { configureContainerEditor } from './containerEditor';

export function registerContainerEditor(
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
				await configureServerForm(context, panel, store, server, descriptor.duplicate);
				return;
			}
			if (!server || server.type !== 'container')
				throw new Error('The connection no longer exists.');
			configureContainerEditor(context.extensionUri, panel, server, store);
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
	return openEditor({
		kind: 'serverForm',
		serverType: 'container',
		serverId: server?.id,
		duplicate,
	});
}

export function openServerConnection(server: Server): Thenable<unknown> {
	return openEditor({ kind: 'containerEditor', serverId: server.id });
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
