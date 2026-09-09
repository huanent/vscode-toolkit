import * as vscode from 'vscode';
import { registerManagementFeature } from './managementPanel';
import { ServerStore } from './serverStore';
import { registerDatabaseEditor } from './editor';
import { registerDatabaseTools } from './tools';
import { MysqlSqlEditorController } from './mysql/mysqlSqlEditor';

export async function registerDatabase(context: vscode.ExtensionContext): Promise<void> {
	const store = await ServerStore.create(context);
	context.subscriptions.push(store);
	const sqlEditor = new MysqlSqlEditorController(context, store);
	context.subscriptions.push(sqlEditor);
	context.subscriptions.push(
		registerManagementFeature(context, store),
		registerDatabaseEditor(
			context,
			store,
			(serverId, database, initialSql) => void sqlEditor.open(serverId, database, initialSql),
		),
		registerDatabaseTools(store),
	);
}
