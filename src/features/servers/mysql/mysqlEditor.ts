import * as vscode from 'vscode';
import { Connection, RowDataPacket } from 'mysql2/promise';
import { MysqlEditorMessage } from './types';
import { createMysqlConnection } from './mysqlConnection';
import { normalizeTableInfo } from './tableData';
import { MysqlServer } from '../servers/server';
import { ServerCredentials } from '../servers/serverStore';
import { exportMysqlDatabase, importMysqlDatabase } from './mysqlDatabaseTransfer';
import { getWebviewHtml } from '../webview';
import {
	parseCreateTableDefinition,
	readTableDefinition,
	buildCreateTableSql,
	buildAlterTableSql,
} from './tableDefinition';

export function configureMysqlEditor(
	extensionUri: vscode.Uri,
	panel: vscode.WebviewPanel,
	server: MysqlServer,
	credentials: ServerCredentials,
	openTable: (database: string, table: string) => void,
	openSql: (database: string, initialSql?: string) => void,
): void {
	panel.title = server.name;
	panel.webview.options = {
		enableScripts: true,
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
	};
	panel.iconPath = new vscode.ThemeIcon('database');
	panel.webview.html = getWebviewHtml(panel.webview, extensionUri, 'mysqlOverview', server.name);

	let connection: Connection | undefined;
	let databases = new Set<string>();
	let tables = new Set<string>();
	let currentDatabase = server.database;
	let disposed = false;
	let pendingTableStatement: { id: string; database: string; sql: string } | undefined;

	panel.onDidDispose(() => {
		disposed = true;
		void connection?.end();
	});
	panel.webview.onDidReceiveMessage(async (message: MysqlEditorMessage) => {
		if (message.type === 'ready') {
			await panel.webview.postMessage({
				type: 'initialize',
				server: {
					name: server.name,
					address: `${server.username}@${server.host}:${server.port}`,
					database: server.database,
				},
			});
			await connectAndLoad();
			return;
		}
		if (!connection) {
			return;
		}
		if (message.type === 'createDatabase') {
			await createDatabase();
			return;
		}
		if (
			message.type === 'deleteDatabase' &&
			typeof message.database === 'string' &&
			databases.has(message.database)
		) {
			await deleteDatabase(message.database);
			return;
		}
		if (message.type === 'importDatabase' && currentDatabase) {
			await importDatabase();
			return;
		}
		if (
			message.type === 'exportDatabase' &&
			typeof message.database === 'string' &&
			databases.has(message.database)
		) {
			await exportDatabase(message.database);
			return;
		}
		if (
			message.type === 'selectDatabase' &&
			typeof message.database === 'string' &&
			databases.has(message.database)
		) {
			currentDatabase = message.database;
			await loadTables();
			return;
		}
		if (message.type === 'refresh') {
			await loadTables();
			return;
		}
		if (
			message.type === 'openSql' &&
			typeof message.database === 'string' &&
			message.database === currentDatabase
		) {
			openSql(currentDatabase);
			return;
		}
		if (
			message.type === 'loadTableDefinition' &&
			message.database === currentDatabase &&
			typeof message.table === 'string' &&
			tables.has(message.table)
		) {
			await loadTableDefinition(message.table);
			return;
		}
		if (
			message.type === 'previewCreateTable' &&
			typeof message.database === 'string' &&
			message.database === currentDatabase
		) {
			previewCreateTable(message.definition);
			return;
		}
		if (
			message.type === 'previewAlterTable' &&
			message.database === currentDatabase &&
			typeof message.table === 'string' &&
			tables.has(message.table)
		) {
			await previewAlterTable(message.table, message.definition);
			return;
		}
		if (message.type === 'confirmTableStatement' && typeof message.confirmationId === 'string') {
			await confirmTableStatement(message.confirmationId);
			return;
		}
		if (
			message.type === 'deleteTable' &&
			typeof message.database === 'string' &&
			typeof message.table === 'string' &&
			message.database === currentDatabase &&
			tables.has(message.table)
		) {
			await deleteTable(message.table);
			return;
		}
		if (
			message.type === 'openTable' &&
			typeof message.database === 'string' &&
			typeof message.table === 'string' &&
			message.database === currentDatabase &&
			tables.has(message.table)
		) {
			openTable(currentDatabase, message.table);
		}
	});

	async function connectAndLoad(): Promise<void> {
		if (connection) {
			return;
		}
		try {
			connection = await createMysqlConnection(server, credentials);
			if (disposed) {
				await connection.end();
				return;
			}
			await loadDatabases();
			await loadTables();
		} catch (error) {
			void panel.webview.postMessage({ type: 'connectionError', message: errorMessage(error) });
		}
	}

	async function loadDatabases(preferredDatabase?: string): Promise<void> {
		if (!connection) {
			return;
		}
		const [rows] = await connection.query<RowDataPacket[]>(
			'SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME',
		);
		databases = new Set(rows.map(row => String(row.name)));
		if (preferredDatabase && databases.has(preferredDatabase)) {
			currentDatabase = preferredDatabase;
		} else if (!databases.has(currentDatabase)) {
			currentDatabase = databases.values().next().value ?? '';
		}
		void panel.webview.postMessage({
			type: 'databases',
			databases: [...databases],
			selectedDatabase: currentDatabase,
			forceSelection: Boolean(preferredDatabase),
		});
	}

	async function createDatabase(): Promise<void> {
		if (!connection) {
			return;
		}
		const name = await vscode.window.showInputBox({
			title: 'Create MySQL Database',
			prompt: 'Enter a database name',
			validateInput: value => {
				const databaseName = value.trim();
				if (!databaseName) {
					return 'Database name is required';
				}
				if (Buffer.byteLength(databaseName, 'utf8') > 64) {
					return 'Database name must be 64 bytes or fewer';
				}
				if (databases.has(databaseName)) {
					return 'A database with this name already exists';
				}
				return undefined;
			},
		});
		const databaseName = name?.trim();
		if (!databaseName) {
			return;
		}
		try {
			await connection.query('CREATE DATABASE ?? CHARACTER SET utf8mb4', [databaseName]);
			await loadDatabases(databaseName);
			await loadTables();
			void vscode.window.showInformationMessage(`Created database “${databaseName}”.`);
		} catch (error) {
			void vscode.window.showErrorMessage(`Could not create database: ${errorMessage(error)}`);
		}
	}

	async function deleteDatabase(database: string): Promise<void> {
		if (!connection) {
			return;
		}
		const confirmation = await vscode.window.showWarningMessage(
			`Delete database “${database}” and all of its data?`,
			{ modal: true },
			'Delete',
		);
		if (confirmation !== 'Delete') {
			return;
		}
		try {
			const deletingCurrentDatabase = database === currentDatabase;
			await connection.query('DROP DATABASE ??', [database]);
			await loadDatabases();
			if (deletingCurrentDatabase) {
				await loadTables();
			}
			void vscode.window.showInformationMessage(`Deleted database “${database}”.`);
		} catch (error) {
			void vscode.window.showErrorMessage(`Could not delete database: ${errorMessage(error)}`);
		}
	}

	async function exportDatabase(database: string): Promise<void> {
		try {
			await exportMysqlDatabase(server, credentials, database);
		} catch (error) {
			void vscode.window.showErrorMessage(`Could not export database: ${errorMessage(error)}`);
		}
	}

	async function importDatabase(): Promise<void> {
		const database = currentDatabase;
		try {
			const completed = await importMysqlDatabase(server, credentials, database);
			if (completed) {
				await loadTables();
			}
		} catch (error) {
			void vscode.window.showErrorMessage(`Could not import database: ${errorMessage(error)}`);
		}
	}

	async function deleteTable(table: string): Promise<void> {
		if (!connection || !currentDatabase) {
			return;
		}
		const database = currentDatabase;
		const confirmation = await vscode.window.showWarningMessage(
			`Delete table “${database}.${table}” and all of its data?`,
			{ modal: true },
			'Delete',
		);
		if (confirmation !== 'Delete') {
			return;
		}
		try {
			await connection.query('DROP TABLE ??.??', [database, table]);
			await loadTables();
			void vscode.window.showInformationMessage(`Deleted table “${database}.${table}”.`);
		} catch (error) {
			void vscode.window.showErrorMessage(`Could not delete table: ${errorMessage(error)}`);
		}
	}

	async function loadTableDefinition(table: string): Promise<void> {
		if (!connection || !currentDatabase) {
			return;
		}
		try {
			const definition = await readTableDefinition(connection, currentDatabase, table);
			void panel.webview.postMessage({ type: 'tableDefinition', table, definition });
		} catch (error) {
			void panel.webview.postMessage({
				type: 'tableDefinitionError',
				message: errorMessage(error),
			});
		}
	}

	function previewCreateTable(definitionValue: unknown): void {
		if (!connection || !currentDatabase) {
			return;
		}
		try {
			const definition = parseCreateTableDefinition(definitionValue, tables);
			const sql = buildCreateTableSql(definition, currentDatabase, value =>
				connection!.escape(value),
			);
			pendingTableStatement = { id: crypto.randomUUID(), database: currentDatabase, sql };
			void panel.webview.postMessage({
				type: 'tableStatementPreview',
				confirmationId: pendingTableStatement.id,
				sql,
			});
		} catch (error) {
			pendingTableStatement = undefined;
			void panel.webview.postMessage({ type: 'tableCreateError', message: errorMessage(error) });
		}
	}

	async function previewAlterTable(table: string, definitionValue: unknown): Promise<void> {
		if (!connection || !currentDatabase) {
			return;
		}
		try {
			const original = await readTableDefinition(connection, currentDatabase, table);
			const definition = parseCreateTableDefinition(
				definitionValue,
				tables,
				table,
				new Set(original.columns.map(column => column.name)),
			);
			const sql = buildAlterTableSql(original, definition, currentDatabase, value =>
				connection!.escape(value),
			);
			pendingTableStatement = { id: crypto.randomUUID(), database: currentDatabase, sql };
			void panel.webview.postMessage({
				type: 'tableStatementPreview',
				confirmationId: pendingTableStatement.id,
				sql,
			});
		} catch (error) {
			pendingTableStatement = undefined;
			void panel.webview.postMessage({ type: 'tableCreateError', message: errorMessage(error) });
		}
	}

	async function confirmTableStatement(confirmationId: string): Promise<void> {
		if (
			!connection ||
			!pendingTableStatement ||
			pendingTableStatement.id !== confirmationId ||
			pendingTableStatement.database !== currentDatabase
		) {
			void panel.webview.postMessage({
				type: 'tableCreateError',
				message: 'The SQL preview has expired. Review the form again.',
			});
			return;
		}
		const { sql } = pendingTableStatement;
		try {
			await connection.query(sql);
			pendingTableStatement = undefined;
			await loadTables();
			void panel.webview.postMessage({ type: 'tableStatementExecuted' });
		} catch (error) {
			void panel.webview.postMessage({ type: 'tableCreateError', message: errorMessage(error) });
		}
	}

	async function loadTables(): Promise<void> {
		if (!connection || !currentDatabase) {
			tables.clear();
			void panel.webview.postMessage({ type: 'tables', database: currentDatabase, tables: [] });
			return;
		}

		const database = currentDatabase;
		void panel.webview.postMessage({ type: 'tablesLoading', database });
		try {
			const [rows] = await connection.query<RowDataPacket[]>(
				`SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_ROWS AS rowCount,
					DATA_LENGTH AS dataSize, INDEX_LENGTH AS indexSize, UPDATE_TIME AS updatedAt,
					TABLE_COLLATION AS collation
				FROM information_schema.TABLES
				WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
				ORDER BY TABLE_NAME`,
				[database],
			);
			if (database !== currentDatabase) {
				return;
			}
			const tableInfo = rows.map(normalizeTableInfo);
			tables = new Set(tableInfo.map(table => table.name));
			void panel.webview.postMessage({
				type: 'tables',
				database,
				tables: tableInfo,
			});
		} catch (error) {
			void panel.webview.postMessage({ type: 'tablesError', message: errorMessage(error) });
		}
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
