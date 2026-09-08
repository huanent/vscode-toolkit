import * as vscode from 'vscode';
import { registerServerCommands } from './commands';
import { registerServersEditor } from './editors/serversEditor';
import { MysqlSqlEditorController } from './mysql/mysqlSqlEditor';
import { combineServerStores, ServerStore } from './servers/serverStore';
import { registerServersTools } from './tools/serversTools';
import { initializeSftpFileEditing } from './ssh/sshTerminal';
import { registerSsh } from '../ssh/registerSsh';
import { registerDatabase } from '../database/registerDatabase';
import { registerContainer } from '../container/registerContainer';

export async function registerServers(context: vscode.ExtensionContext): Promise<void> {
	await initializeSftpFileEditing(context);
	const sshStore = await ServerStore.create(context, 'ssh');
	context.subscriptions.push(sshStore);
	const databaseStore = await ServerStore.create(context, 'mysql');
	context.subscriptions.push(databaseStore);
	const containerStore = await ServerStore.create(context, 'container');
	context.subscriptions.push(containerStore);
	const stores = { ssh: sshStore, mysql: databaseStore, container: containerStore };
	const serverStore = combineServerStores(stores);
	const mysqlSqlEditor = new MysqlSqlEditorController(context, databaseStore);

	context.subscriptions.push(
		serverStore,
		mysqlSqlEditor,
		registerServersTools(serverStore),
		registerServersEditor(
			context,
			stores,
			(serverId, database, initialSql) => void mysqlSqlEditor.open(serverId, database, initialSql),
		),
		registerServerCommands(sshStore),
		registerSsh(context, sshStore),
		registerDatabase(context, databaseStore),
		registerContainer(context, containerStore),
	);
}
