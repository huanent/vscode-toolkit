import * as vscode from 'vscode';
import { configureContainerEditor } from '../containers/containerEditor';
import { configureServerForm } from '../serverForm/serverFormPanel';
import { configureMysqlEditor } from '../mysql/mysqlEditor';
import { configureMysqlTablePreview } from '../mysql/mysqlTablePreview';
import { MysqlServer, Server, ServerType } from '../servers/server';
import { ServerStore } from '../servers/serverStore';
import { configureSshTerminal } from '../ssh/sshTerminal';
import {
	createEditorUri,
	EditorDescriptor,
	parseEditorDescriptor,
	serversEditorViewType,
} from './editorDescriptor';

class ServersDocument implements vscode.CustomDocument {
	constructor(
		readonly uri: vscode.Uri,
		readonly descriptor: EditorDescriptor,
	) {}
	dispose(): void {}
}

export function registerServersEditor(
	context: vscode.ExtensionContext,
	serverStore: ServerStore,
	openMysqlSqlEditor: (serverId: string, database: string, initialSql?: string) => void,
): vscode.Disposable {
	const provider: vscode.CustomReadonlyEditorProvider<ServersDocument> = {
		openCustomDocument: uri => new ServersDocument(uri, parseEditorDescriptor(uri)),
		resolveCustomEditor: async (document, panel) => {
			const { descriptor } = document;
			if (descriptor.kind === 'serverForm') {
				const server = descriptor.serverId
					? findServer(serverStore, descriptor.serverId)
					: undefined;
				const serverType = server?.type ?? descriptor.serverType;
				if (!serverType) {
					throw new Error('The server form does not specify a server type.');
				}
				await configureServerForm(
					context,
					panel,
					serverStore,
					serverType,
					server,
					descriptor.duplicate,
				);
				return;
			}

			const server = findServer(serverStore, descriptor.serverId);
			if (descriptor.kind === 'containerEditor' && server.type === 'container') {
				configureContainerEditor(context.extensionUri, panel, server, serverStore);
				return;
			}
			if (descriptor.kind === 'sshTerminal' && server.type === 'ssh') {
				const credentials = await serverStore.getCredentials(server.id);
				if (server.authType === 'privateKey' ? !credentials.privateKey : !credentials.password) {
					throw new Error(
						`No ${server.authType === 'privateKey' ? 'private key' : 'password'} is available for “${server.name}” on this device.`,
					);
				}
				configureSshTerminal(context, panel, server, credentials);
				return;
			}
			const credentials = await serverStore.getCredentials(server.id);
			if (!credentials.password) {
				throw new Error(`No password is available for “${server.name}” on this device.`);
			}
			if (descriptor.kind === 'mysqlEditor' && server.type === 'mysql') {
				configureMysqlEditor(
					context.extensionUri,
					panel,
					server,
					credentials,
					(database, table) => void openMysqlTablePreview(server, database, table),
					(database, initialSql) => openMysqlSqlEditor(server.id, database, initialSql),
				);
				return;
			}
			if (
				descriptor.kind === 'mysqlTablePreview' &&
				server.type === 'mysql' &&
				descriptor.database &&
				descriptor.table
			) {
				configureMysqlTablePreview(
					context.extensionUri,
					panel,
					server,
					credentials,
					descriptor.database,
					descriptor.table,
				);
				return;
			}
			throw new Error('The Servers editor resource is invalid.');
		},
	};

	return vscode.window.registerCustomEditorProvider(serversEditorViewType, provider, {
		supportsMultipleEditorsPerDocument: true,
		webviewOptions: { retainContextWhenHidden: true },
	});
}

export function openServerForm(
	serverType: ServerType,
	server?: Server,
	duplicate = false,
): Thenable<unknown> {
	return openEditor({ kind: 'serverForm', serverType, serverId: server?.id, duplicate });
}

export function openServerConnection(server: Server): Thenable<unknown> {
	return openEditor({
		kind:
			server.type === 'ssh'
				? 'sshTerminal'
				: server.type === 'mysql'
					? 'mysqlEditor'
					: 'containerEditor',
		serverId: server.id,
	});
}

function openMysqlTablePreview(
	server: MysqlServer,
	database: string,
	table: string,
): Thenable<unknown> {
	return openEditor({ kind: 'mysqlTablePreview', serverId: server.id, database, table });
}

function openEditor(descriptor: EditorDescriptor): Thenable<unknown> {
	return vscode.commands.executeCommand(
		'vscode.openWith',
		createEditorUri(descriptor),
		serversEditorViewType,
		{
			preview: false,
			viewColumn: vscode.ViewColumn.Active,
		},
	);
}

function findServer(serverStore: ServerStore, serverId?: string): Server {
	const server = serverId
		? serverStore.getServers().find(candidate => candidate.id === serverId)
		: undefined;
	if (!server) {
		throw new Error('The server no longer exists.');
	}
	return server;
}
