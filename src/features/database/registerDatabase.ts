import * as vscode from 'vscode';
import { registerManagementFeature } from './managementPanel';
import { ServerStore } from './serverStore';
import { registerDatabaseEditor } from './editor';
import { registerDatabaseTools } from './tools';
import { MysqlSqlEditorController } from './mysql/mysqlSqlEditor';
import { registerSqliteEditor } from './sqlite/editor';
import type { ResultView } from '../result/resultView';

export async function registerDatabase(context: vscode.ExtensionContext, resultView: ResultView): Promise<void> {
	context.subscriptions.push(registerSqliteEditor(context));
	const store = await ServerStore.create(context);
	context.subscriptions.push(store);
	const sqlEditor = new MysqlSqlEditorController(context, store, resultView);
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
