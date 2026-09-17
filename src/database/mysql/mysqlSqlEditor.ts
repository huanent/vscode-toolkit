import { getStorageUri } from '../../storagePath';
import type { Result, ResultMessage } from '../../result/protocol';
import * as vscode from 'vscode';
import { homedir } from 'node:os';
import { FieldPacket, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ServerStore } from '../serverStore';
import type { ResultView } from '../../result/resultView';
import { createMysqlConnection } from './mysqlConnection';
import { displayMysqlValue } from './tableData';
import { executeSql } from './sqlRunner';

const executeCommandId = 'vscode-toolkit.servers.executeMysqlSql';
const exportResultsCommandId = 'vscode-toolkit.servers.exportMysqlSqlResults';
const activeContextKey = 'vscode-toolkit.servers.mysqlSqlEditorActive';
const resultsExportableContextKey = 'vscode-toolkit.servers.mysqlSqlResultsExportable';

interface SqlDocumentContext {
	serverId: string;
	database: string;
	temporaryDirectory: vscode.Uri;
	completionMetadata?: SqlCompletionMetadata;
	completionMetadataLoad?: Promise<void>;
}

interface SqlCompletionMetadata {
	tables: Map<string, string[]>;
}

const sqlKeywords = [
	'SELECT',
	'FROM',
	'WHERE',
	'INSERT INTO',
	'VALUES',
	'UPDATE',
	'SET',
	'DELETE FROM',
	'JOIN',
	'LEFT JOIN',
	'RIGHT JOIN',
	'INNER JOIN',
	'ON',
	'AS',
	'AND',
	'OR',
	'NOT',
	'NULL',
	'IS NULL',
	'IS NOT NULL',
	'IN',
	'LIKE',
	'BETWEEN',
	'EXISTS',
	'DISTINCT',
	'GROUP BY',
	'ORDER BY',
	'HAVING',
	'LIMIT',
	'OFFSET',
	'ASC',
	'DESC',
	'COUNT',
	'SUM',
	'AVG',
	'MIN',
	'MAX',
	'CREATE TABLE',
	'ALTER TABLE',
	'DROP TABLE',
	'TRUNCATE TABLE',
];

export class MysqlSqlEditorController implements vscode.Disposable {
	private readonly documentContexts = new Map<string, SqlDocumentContext>();
	private readonly documentSaves = new Map<string, Promise<void>>();
	private readonly connectionStatus: vscode.StatusBarItem;
	private readonly disposables: vscode.Disposable[];

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly serverStore: ServerStore,
		private readonly resultView: ResultView,
	) {
		this.connectionStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
		this.connectionStatus.name = 'MySQL SQL Connection';
		this.disposables = [
			this.connectionStatus,
			vscode.commands.registerTextEditorCommand(executeCommandId, editor => this.execute(editor)),
			vscode.commands.registerCommand(exportResultsCommandId, () => this.exportResult()),
			vscode.languages.registerCompletionItemProvider(
				{ language: 'sql' },
				{
					provideCompletionItems: (document, position) =>
						this.provideCompletionItems(document, position),
				},
				'.',
			),
			vscode.window.onDidChangeActiveTextEditor(() => this.updateActiveContext()),
			vscode.workspace.onDidChangeTextDocument(event => this.saveDocument(event.document)),
			vscode.workspace.onDidCloseTextDocument(document => {
				const documentKey = document.uri.toString();
				const documentContext = this.documentContexts.get(documentKey);
				this.documentContexts.delete(documentKey);
				const pendingSave = this.documentSaves.get(documentKey) ?? Promise.resolve();
				if (documentContext) {
					void pendingSave.finally(() =>
						vscode.workspace.fs.delete(documentContext.temporaryDirectory, { recursive: true }),
					);
				}
				this.updateActiveContext();
			}),
		];
		this.updateActiveContext();
	}

	async open(serverId: string, database: string, initialSql = ''): Promise<void> {
		const temporaryDirectory = vscode.Uri.joinPath(
			getStorageUri(this.context, 'database'),
			'mysql-sql',
			crypto.randomUUID(),
		);
		const documentUri = vscode.Uri.joinPath(temporaryDirectory, `${safeFileName(database)}.sql`);
		await vscode.workspace.fs.createDirectory(temporaryDirectory);
		await vscode.workspace.fs.writeFile(documentUri, Buffer.from(initialSql));
		const document = await vscode.workspace.openTextDocument(documentUri);
		const documentContext = { serverId, database, temporaryDirectory };
		this.documentContexts.set(document.uri.toString(), documentContext);
		this.ensureCompletionMetadata(documentContext);
		await vscode.window.showTextDocument(document, {
			preview: false,
			viewColumn: vscode.ViewColumn.Active,
		});
		this.updateActiveContext();
	}

	dispose(): void {
		void vscode.commands.executeCommand('setContext', activeContextKey, false);
		void vscode.commands.executeCommand('setContext', resultsExportableContextKey, false);
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}

	private async execute(editor: vscode.TextEditor): Promise<void> {
		const context = this.documentContexts.get(editor.document.uri.toString());
		if (!context) {
			return;
		}
		const sql = (
			editor.selection.isEmpty
				? editor.document.getText()
				: editor.document.getText(editor.selection)
		).trim();
		if (!sql) {
			return;
		}

		const server = this.serverStore
			.getServers()
			.find(candidate => candidate.id === context.serverId);
		if (!server || server.type !== 'mysql') {
			void vscode.window.showErrorMessage('The MySQL server no longer exists.');
			return;
		}
		const credentials = await this.serverStore.getCredentials(server.id);
		if (!credentials.password) {
			void vscode.window.showErrorMessage(
				`No password is available for “${server.name}” on this device.`,
			);
			return;
		}

		const taskResult: Result = {
			type: 'table', data: {
				label: context.database, source: `${server.name} / ${context.database}`,
				kind: 'command', summary: 'Executing SQL...', message: sql,
			}
		};
		await this.resultView.run(taskResult, async signal => {
			const startedAt = performance.now();
			const queryResult = await executeSql(() => createMysqlConnection(server, credentials, context.database), sql, signal);
			if (!queryResult) {
				taskResult.data = { ...taskResult.data, kind: 'command', summary: 'No statements to execute.', message: 'No statements to execute.' };
				return;
			}
			const [result, fields] = queryResult;
			const durationMs = Math.round(performance.now() - startedAt);
			if (Array.isArray(result)) {
				taskResult.data = toResultMessage(this.showRows(
					server.name,
					context.database,
					result as RowDataPacket[],
					fields as FieldPacket[],
					durationMs,
				)).result.data;
			} else {
				taskResult.data = toResultMessage(this.showCommandResult(
					server.name,
					context.database,
					result as ResultSetHeader,
					durationMs,
				)).result.data;
			}
		});
	}

	private provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
	): vscode.CompletionItem[] | undefined {
		const context = this.documentContexts.get(document.uri.toString());
		if (!context) {
			return undefined;
		}

		const textBeforeCursor = document.getText(
			new vscode.Range(new vscode.Position(0, 0), position),
		);
		const completionContext = getSqlCompletionContext(textBeforeCursor);
		const items = sqlKeywords.map((keyword, index) => {
			const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
			item.insertText = keyword;
			const priority = completionContext.preferredKeywords.has(keyword)
				? completionContext.preferredKeywordPriority
				: completionContext.keywordPriority;
			item.sortText = completionSortText(priority, index, keyword);
			return item;
		});
		this.ensureCompletionMetadata(context);
		const metadata = context.completionMetadata;
		const qualifier = /(?:`([^`]+)`|([A-Za-z_$][\w$]*))\.\s*$/.exec(textBeforeCursor);
		if (qualifier) {
			const qualifierName = qualifier[1] ?? qualifier[2];
			const columns =
				metadata && findQualifiedTableColumns(metadata.tables, qualifierName, textBeforeCursor);
			return (
				columns?.map((column, index) =>
					createIdentifierCompletion(
						column,
						vscode.CompletionItemKind.Field,
						completionSortText(0, index, column),
					),
				) ?? items
			);
		}

		let tableIndex = 0;
		let columnIndex = 0;
		for (const [table, columns] of metadata?.tables ?? []) {
			const tableItem = createIdentifierCompletion(
				table,
				vscode.CompletionItemKind.Struct,
				completionSortText(completionContext.tablePriority, tableIndex++, table),
			);
			tableItem.detail = `Table in ${context.database}`;
			items.push(tableItem);
			for (const column of columns) {
				const columnItem = createIdentifierCompletion(
					column,
					vscode.CompletionItemKind.Field,
					completionSortText(completionContext.columnPriority, columnIndex++, column),
				);
				columnItem.detail = `Column in ${table}`;
				items.push(columnItem);
			}
		}
		return items;
	}

	private ensureCompletionMetadata(context: SqlDocumentContext): void {
		context.completionMetadataLoad ??= this.loadCompletionMetadata(context)
			.then(metadata => {
				context.completionMetadata = metadata;
			})
			.catch(() => {
				context.completionMetadata = { tables: new Map() };
			});
	}

	private async loadCompletionMetadata(
		context: SqlDocumentContext,
	): Promise<SqlCompletionMetadata> {
		const server = this.serverStore
			.getServers()
			.find(candidate => candidate.id === context.serverId);
		if (!server || server.type !== 'mysql') {
			return { tables: new Map() };
		}
		const credentials = await this.serverStore.getCredentials(server.id);
		if (!credentials.password) {
			return { tables: new Map() };
		}

		const connection = await createMysqlConnection(server, credentials, context.database);
		try {
			const [rows] = await connection.query<RowDataPacket[]>(
				`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
				FROM information_schema.COLUMNS
				WHERE TABLE_SCHEMA = ?
				ORDER BY TABLE_NAME, ORDINAL_POSITION`,
				[context.database],
			);
			const tables = new Map<string, string[]>();
			for (const row of rows) {
				const tableName = String(row.tableName);
				const columns = tables.get(tableName) ?? [];
				columns.push(String(row.columnName));
				tables.set(tableName, columns);
			}
			return { tables };
		} finally {
			await connection.end();
		}
	}

	private showRows(
		serverName: string,
		database: string,
		rows: RowDataPacket[],
		fields: FieldPacket[],
		durationMs: number,
	): SqlResultModel {
		const columns = fields.map(field => field.name);
		const values = rows.map(row =>
			columns.map(column => {
				const value = displayMysqlValue(row[column]);
				return value;
			}),
		);
		return {
			serverName,
			database,
			summary: `${rows.length.toLocaleString()} row(s) · ${durationMs.toLocaleString()} ms`,
			kind: 'rows',
			columns,
			rows: values,
		};
	}

	private showCommandResult(
		serverName: string,
		database: string,
		result: ResultSetHeader,
		durationMs: number,
	): SqlResultModel {
		const parts = [`${result.affectedRows.toLocaleString()} row(s) affected`];
		if (result.insertId) {
			parts.push(`Insert id ${result.insertId.toLocaleString()}`);
		}
		if (result.warningStatus) {
			parts.push(`${result.warningStatus.toLocaleString()} warning(s)`);
		}
		parts.push(`${durationMs.toLocaleString()} ms`);
		return {
			serverName,
			database,
			summary: parts.join(' · '),
			kind: 'command',
			message: 'Command completed successfully.',
		};
	}

	private async exportResult(): Promise<void> {
		const selected = this.resultView.selectedResult;
		if (selected?.type !== 'table' || selected.data.kind !== 'rows') {
			return;
		}
		const result = { ...selected.data, serverName: selected.data.source ?? '', database: selected.data.label ?? 'query' };
		const format = await vscode.window.showQuickPick(
			[
				{ label: 'JSON', description: 'JSON object array', extension: 'json' as const },
				{ label: 'CSV', description: 'Comma-separated values', extension: 'csv' as const },
			],
			{ placeHolder: 'Select export format', title: 'Export SQL Results' },
		);
		if (!format) {
			return;
		}
		const target = await vscode.window.showSaveDialog({
			filters: { [format.label]: [format.extension] },
			defaultUri: vscode.Uri.joinPath(
				vscode.Uri.file(homedir()),
				`${safeFileName(result.database)}-results.${format.extension}`,
			),
			saveLabel: 'Export',
		});
		if (!target) {
			return;
		}
		const contents =
			format.extension === 'json' ? serializeJsonResult(result) : serializeCsvResult(result);
		try {
			await vscode.workspace.fs.writeFile(target, Buffer.from(contents, 'utf8'));
		} catch (error) {
			void vscode.window.showErrorMessage(`Could not export SQL results: ${errorMessage(error)}`);
			return;
		}
		void vscode.window.showInformationMessage(
			`Exported ${result.rows.length.toLocaleString()} row(s) as ${format.label}.`,
		);
	}

	private updateActiveContext(): void {
		const active = vscode.window.activeTextEditor;
		const documentContext = active && this.documentContexts.get(active.document.uri.toString());
		const isActive = Boolean(documentContext);
		if (documentContext) {
			const server = this.serverStore
				.getServers()
				.find(candidate => candidate.id === documentContext.serverId);
			const connectionLabel = server
				? `${server.name} / ${documentContext.database}`
				: documentContext.database;
			this.connectionStatus.text = `$(database) ${connectionLabel}`;
			this.connectionStatus.tooltip = `MySQL connection: ${connectionLabel}`;
			this.connectionStatus.show();
		} else {
			this.connectionStatus.hide();
		}
		void vscode.commands.executeCommand('setContext', activeContextKey, isActive);
	}

	private saveDocument(document: vscode.TextDocument): void {
		const documentKey = document.uri.toString();
		if (!this.documentContexts.has(documentKey) || !document.isDirty) {
			return;
		}
		const previousSave = this.documentSaves.get(documentKey) ?? Promise.resolve();
		const nextSave = previousSave
			.then(async () => {
				while (!document.isClosed && document.isDirty) {
					if (!(await document.save())) {
						break;
					}
				}
			})
			.finally(() => {
				if (this.documentSaves.get(documentKey) === nextSave) {
					this.documentSaves.delete(documentKey);
				}
			});
		this.documentSaves.set(documentKey, nextSave);
	}
}

type SqlResultModel =
	| {
		serverName: string;
		database: string;
		summary: string;
		kind: 'rows';
		columns: string[];
		rows: Array<Array<string | null>>;
	}
	| { serverName: string; database: string; summary: string; kind: 'command'; message: string };

function toResultMessage(result: SqlResultModel): ResultMessage & { result: Extract<Result, { type: 'table' }> } {
	return {
		type: 'result',
		result: {
			type: 'table',
			data: {
				...result,
				label: 'SQL results',
				source: `Database ${result.serverName} / ${result.database}`,
			},
		},
	};
}

function safeFileName(value: string): string {
	const fileName = value.replaceAll(/[\\/:*?"<>|\r\n]/g, '_').trim();
	return fileName || 'query';
}

function serializeJsonResult(result: Extract<SqlResultModel, { kind: 'rows' }>): string {
	const rows = result.rows.map(row =>
		Object.fromEntries(result.columns.map((column, index) => [column, row[index]])),
	);
	return `${JSON.stringify(rows, undefined, 2)}\n`;
}

function serializeCsvResult(result: Extract<SqlResultModel, { kind: 'rows' }>): string {
	const escape = (value: string | null) =>
		value === null ? '' : `"${value.replaceAll('"', '""')}"`;
	return `${[result.columns.map(escape), ...result.rows.map(row => row.map(escape))].map(row => row.join(',')).join('\r\n')}\r\n`;
}

function createIdentifierCompletion(
	label: string,
	kind: vscode.CompletionItemKind,
	sortText: string,
): vscode.CompletionItem {
	const item = new vscode.CompletionItem(label, kind);
	item.insertText = /^[A-Za-z_$][\w$]*$/.test(label) ? label : `\`${label.replaceAll('`', '``')}\``;
	item.sortText = sortText;
	return item;
}

function completionSortText(priority: number, index: number, label: string): string {
	return `${priority.toString().padStart(2, '0')}_${index.toString().padStart(4, '0')}_${label.toLowerCase()}`;
}

function findTableColumns(tables: Map<string, string[]>, tableName: string): string[] | undefined {
	const normalizedName = tableName.toLowerCase();
	for (const [candidate, columns] of tables) {
		if (candidate.toLowerCase() === normalizedName) {
			return columns;
		}
	}
	return undefined;
}

function findQualifiedTableColumns(
	tables: Map<string, string[]>,
	qualifier: string,
	textBeforeCursor: string,
): string[] | undefined {
	const directColumns = findTableColumns(tables, qualifier);
	if (directColumns) {
		return directColumns;
	}

	const relationPattern =
		/\b(?:FROM|JOIN)\s+(?:`([^`]+)`|([A-Za-z_$][\w$]*))(?:\s+(?:AS\s+)?(?:`([^`]+)`|([A-Za-z_$][\w$]*)))?/gi;
	for (const match of textBeforeCursor.matchAll(relationPattern)) {
		const tableName = match[1] ?? match[2];
		const alias = match[3] ?? match[4];
		if (alias?.toLowerCase() === qualifier.toLowerCase()) {
			return findTableColumns(tables, tableName);
		}
	}
	return undefined;
}

interface SqlCompletionContext {
	keywordPriority: number;
	preferredKeywordPriority: number;
	tablePriority: number;
	columnPriority: number;
	preferredKeywords: Set<string>;
}

function getSqlCompletionContext(textBeforeCursor: string): SqlCompletionContext {
	const statementText = textBeforeCursor.slice(textBeforeCursor.lastIndexOf(';') + 1);
	const clauses = statementText.matchAll(
		/\b(ORDER\s+BY|GROUP\s+BY|SELECT|FROM|JOIN|UPDATE|INTO|TABLE|DESCRIBE|SET|WHERE|ON|HAVING|VALUES)\b/gi,
	);
	let currentClause: string | undefined;
	for (const match of clauses) {
		currentClause = match[1].toUpperCase().replace(/\s+/g, ' ');
	}

	if (!currentClause) {
		return sqlCompletionContext(0, 0, 2, 2, [
			'SELECT',
			'INSERT INTO',
			'UPDATE',
			'DELETE FROM',
			'CREATE TABLE',
		]);
	}
	if (['FROM', 'JOIN', 'UPDATE', 'INTO', 'TABLE', 'DESCRIBE'].includes(currentClause)) {
		return sqlCompletionContext(3, 1, 0, 2, [
			'JOIN',
			'LEFT JOIN',
			'RIGHT JOIN',
			'INNER JOIN',
			'WHERE',
			'SET',
			'VALUES',
		]);
	}
	if (currentClause === 'SELECT') {
		return sqlCompletionContext(3, 1, 2, 0, ['FROM', 'AS', 'DISTINCT']);
	}
	if (currentClause === 'ORDER BY') {
		return sqlCompletionContext(3, 1, 2, 0, ['ASC', 'DESC', 'LIMIT', 'OFFSET']);
	}
	if (currentClause === 'GROUP BY') {
		return sqlCompletionContext(3, 1, 2, 0, ['HAVING', 'ORDER BY', 'LIMIT']);
	}
	if (['WHERE', 'ON', 'HAVING'].includes(currentClause)) {
		return sqlCompletionContext(3, 1, 2, 0, [
			'AND',
			'OR',
			'IN',
			'LIKE',
			'BETWEEN',
			'IS NULL',
			'IS NOT NULL',
		]);
	}
	if (currentClause === 'SET') {
		return sqlCompletionContext(3, 1, 2, 0, ['WHERE']);
	}
	if (currentClause === 'VALUES') {
		return sqlCompletionContext(2, 1, 3, 3, ['NULL']);
	}
	return sqlCompletionContext(2, 1, 2, 0, []);
}

function sqlCompletionContext(
	keywordPriority: number,
	preferredKeywordPriority: number,
	tablePriority: number,
	columnPriority: number,
	preferredKeywords: string[],
): SqlCompletionContext {
	return {
		keywordPriority,
		preferredKeywordPriority,
		tablePriority,
		columnPriority,
		preferredKeywords: new Set(preferredKeywords),
	};
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
