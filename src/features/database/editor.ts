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
import { configureMysqlEditor } from './mysql/mysqlEditor';
import { configureMysqlTablePreview } from './mysql/mysqlTablePreview';

export function registerDatabaseEditor(
	context: vscode.ExtensionContext,
	store: ServerStore,
	openSql: (serverId: string, database: string, initialSql?: string) => void,
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
			if (!server || server.type !== 'mysql') throw new Error('The connection no longer exists.');
			const credentials = await store.getCredentials(server.id);
			if (!credentials.password) throw new Error('The database password is missing.');
			if (descriptor.kind === 'mysqlTablePreview') {
				if (!descriptor.database || !descriptor.table)
					throw new Error('The table resource is invalid.');
				configureMysqlTablePreview(
					context.extensionUri,
					panel,
					server,
					credentials,
					descriptor.database,
					descriptor.table,
				);
			} else {
				configureMysqlEditor(
					context.extensionUri,
					panel,
					server,
					credentials,
					(database, table) =>
						void openEditor({ kind: 'mysqlTablePreview', serverId: server.id, database, table }),
					(database, initialSql) => openSql(server.id, database, initialSql),
				);
			}
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
	return openEditor({ kind: 'serverForm', serverType: 'mysql', serverId: server?.id, duplicate });
}

export function openServerConnection(server: Server): Thenable<unknown> {
	return openEditor({ kind: 'mysqlEditor', serverId: server.id });
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
