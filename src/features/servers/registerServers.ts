import * as vscode from 'vscode';
import { registerServerCommands } from './commands';
import { registerServersEditor } from './editors/serversEditor';
import { MysqlSqlEditorController } from './mysql/mysqlSqlEditor';
import { ServerStore } from './servers/serverStore';
import { ServerTreeDataProvider } from './servers/serverTree';
import { registerServersTools } from './tools/serversTools';
import { initializeSftpFileEditing } from './ssh/sshTerminal';

export async function registerServers(context: vscode.ExtensionContext): Promise<void> {
	await initializeSftpFileEditing(context);
	const serverStore = await ServerStore.create(context);
	const treeDataProvider = new ServerTreeDataProvider(serverStore);
	const treeView = vscode.window.createTreeView('vscode-toolkit.servers.servers', {
		treeDataProvider,
		canSelectMany: true,
		showCollapseAll: true,
	});
	const mysqlSqlEditor = new MysqlSqlEditorController(context, serverStore);

	context.subscriptions.push(
		serverStore,
		treeDataProvider,
		mysqlSqlEditor,
		registerServersTools(serverStore),
		registerServersEditor(
			context,
			serverStore,
			(serverId, database, initialSql) => void mysqlSqlEditor.open(serverId, database, initialSql),
		),
		registerServerCommands(serverStore, treeDataProvider, treeView),
		treeView,
	);
}
