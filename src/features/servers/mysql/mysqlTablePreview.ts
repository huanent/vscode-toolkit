import * as vscode from 'vscode';
import { Connection, FieldPacket, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
	MysqlColumnInfo,
	MysqlTableFilter,
	MysqlTablePreviewMessage,
	MysqlTableSort,
} from './types';
import { createMysqlConnection } from './mysqlConnection';
import {
	buildTableFilterClause,
	displayMysqlValue,
	mysqlTablePageSizes,
	parseRowChanges,
	parseTableFilters,
	parseTableSort,
} from './tableData';
import { MysqlServer } from '../servers/server';
import { ServerCredentials } from '../servers/serverStore';
import { getWebviewHtml } from '../webview';

export function configureMysqlTablePreview(
	extensionUri: vscode.Uri,
	panel: vscode.WebviewPanel,
	server: MysqlServer,
	credentials: ServerCredentials,
	database: string,
	table: string,
): void {
	panel.title = `${table} - ${database}`;
	panel.webview.options = {
		enableScripts: true,
		localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
	};
	panel.iconPath = new vscode.ThemeIcon('table');
	panel.webview.html = getWebviewHtml(
		panel.webview,
		extensionUri,
		'mysqlTablePreview',
		`${table} - ${database}`,
	);

	let connection: Connection | undefined;
	let disposed = false;
	let columns: string[] = [];
	let columnInfo: MysqlColumnInfo[] = [];
	let columnNames = new Set<string>();
	let editableColumnNames = new Set<string>();
	let primaryKeyColumns: string[] = [];
	let pageRows = new Map<string, RowDataPacket>();
	let currentRequest = {
		page: 1,
		pageSize: 100,
		sort: undefined as MysqlTableSort | undefined,
		filters: [] as MysqlTableFilter[],
	};
	let pendingRowUpdate: { id: string; query: string; parameters: unknown[] } | undefined;
	let pendingRowInsert: { id: string; query: string; parameters: unknown[] } | undefined;
	panel.onDidDispose(() => {
		disposed = true;
		void connection?.end();
	});
	panel.webview.onDidReceiveMessage(async (message: MysqlTablePreviewMessage) => {
		if (message.type === 'ready') {
			await panel.webview.postMessage({ type: 'initialize', database, table });
			await connectAndLoad();
			return;
		}
		if (message.type === 'previewUpdateRow') {
			previewUpdateRow(message.rowId, message.values);
			return;
		}
		if (message.type === 'confirmRowUpdate') {
			await confirmRowUpdate(message.confirmationId);
			return;
		}
		if (message.type === 'deleteRow') {
			await deleteRow(message.rowId);
			return;
		}
		if (message.type === 'previewInsertRow') {
			previewInsertRow(message.values);
			return;
		}
		if (message.type === 'confirmRowInsert') {
			await confirmRowInsert(message.confirmationId);
			return;
		}
		if (message.type === 'refresh') {
			await loadPage(
				currentRequest.page,
				currentRequest.pageSize,
				currentRequest.sort,
				currentRequest.filters,
			);
			return;
		}
		if (
			message.type !== 'loadPage' ||
			typeof message.page !== 'number' ||
			!Number.isInteger(message.page) ||
			message.page < 1 ||
			typeof message.pageSize !== 'number' ||
			!mysqlTablePageSizes.has(message.pageSize)
		) {
			return;
		}
		const sort = parseTableSort(message.sort, columnNames);
		const filters = parseTableFilters(message.filters, columnNames);
		await loadPage(message.page, message.pageSize, sort, filters);
	});
	async function connectAndLoad(): Promise<void> {
		if (connection) {
			return;
		}
		try {
			connection = await createMysqlConnection(server, credentials, database);
			if (disposed) {
				await connection.end();
				return;
			}
			const [, fields] = await connection.query<RowDataPacket[]>('SELECT * FROM ??.?? LIMIT 0', [
				database,
				table,
			]);
			columns = fields.map((field: FieldPacket) => field.name);
			columnNames = new Set(columns);
			const [metadataRows] = await connection.query<RowDataPacket[]>(
				`SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType, IS_NULLABLE AS isNullable,
					COLUMN_KEY AS columnKey, COLUMN_DEFAULT AS columnDefault, EXTRA AS extra,
					GENERATION_EXPRESSION AS generationExpression
				FROM information_schema.COLUMNS
				WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
				ORDER BY ORDINAL_POSITION`,
				[database, table],
			);
			columnInfo = metadataRows.map(row => {
				const extra = String(row.extra ?? '').toLowerCase();
				const generationExpression = String(row.generationExpression ?? '');
				return {
					name: String(row.name),
					dataType: String(row.dataType),
					boolean:
						String(row.dataType).toLowerCase() === 'bit' &&
						String(row.columnType).toLowerCase() === 'bit(1)',
					nullable: row.isNullable === 'YES',
					primaryKey: row.columnKey === 'PRI',
					autoIncrement: extra.includes('auto_increment'),
					hasDefault: row.columnDefault !== null || extra.includes('default_generated'),
					editable: !generationExpression,
				};
			});
			editableColumnNames = new Set(
				columnInfo.filter(column => column.editable).map(column => column.name),
			);
			primaryKeyColumns = columnInfo.filter(column => column.primaryKey).map(column => column.name);
			await loadPage(1, 100, undefined, []);
		} catch (error) {
			void panel.webview.postMessage({ type: 'tableError', message: errorMessage(error) });
		}
	}

	async function loadPage(
		page: number,
		pageSize: number,
		sort: MysqlTableSort | undefined,
		filters: MysqlTableFilter[],
	): Promise<void> {
		if (!connection) {
			return;
		}
		pendingRowUpdate = undefined;
		pendingRowInsert = undefined;
		currentRequest = { page, pageSize, sort, filters };
		void panel.webview.postMessage({ type: 'tableLoading' });
		try {
			const { clause: whereClause, parameters: filterParameters } = buildTableFilterClause(filters);
			const [countRows] = await connection.query<RowDataPacket[]>(
				`SELECT COUNT(*) AS total FROM ??.??${whereClause}`,
				[database, table, ...filterParameters],
			);
			const totalRows = Number(countRows[0]?.total) || 0;
			const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
			const currentPage = Math.min(page, totalPages);
			const offset = (currentPage - 1) * pageSize;
			const orderClause = sort ? ` ORDER BY ?? ${sort.direction === 'asc' ? 'ASC' : 'DESC'}` : '';
			const [rows] = await connection.query<RowDataPacket[]>(
				`SELECT * FROM ??.??${whereClause}${orderClause} LIMIT ? OFFSET ?`,
				[database, table, ...filterParameters, ...(sort ? [sort.column] : []), pageSize, offset],
			);
			pageRows = new Map();
			const columnMetadata = new Map(columnInfo.map(column => [column.name, column]));
			const tableRows = rows.map(row => {
				const rowId = crypto.randomUUID();
				pageRows.set(rowId, row);
				return {
					rowId,
					values: columns.map(column =>
						displayMysqlValue(row[column], columnMetadata.get(column)?.boolean),
					),
					editValues: columns.map(column =>
						displayMysqlValue(row[column], columnMetadata.get(column)?.boolean),
					),
				};
			});
			void panel.webview.postMessage({
				type: 'tableData',
				columns,
				columnInfo,
				rows: tableRows,
				canEdit: primaryKeyColumns.length > 0,
				editDisabledReason:
					primaryKeyColumns.length > 0
						? undefined
						: 'Rows cannot be edited because this table has no primary key.',
				page: currentPage,
				pageSize,
				totalRows,
				totalPages,
				sort,
				filters,
			});
		} catch (error) {
			void panel.webview.postMessage({ type: 'tableError', message: errorMessage(error) });
		}
	}

	function previewUpdateRow(rowIdValue: unknown, valuesValue: unknown): void {
		if (!connection || typeof rowIdValue !== 'string' || primaryKeyColumns.length === 0) {
			return;
		}
		const originalRow = pageRows.get(rowIdValue);
		const changes = parseRowChanges(valuesValue, editableColumnNames, columnInfo);
		if (!originalRow || changes.length === 0) {
			return;
		}
		try {
			const setClause = changes.map(() => '?? = ?').join(', ');
			const whereClause = primaryKeyColumns.map(() => '?? <=> ?').join(' AND ');
			const query = `UPDATE ??.?? SET ${setClause} WHERE ${whereClause} LIMIT 1`;
			const parameters = [
				database,
				table,
				...changes.flatMap(change => [change.column, change.value]),
				...primaryKeyColumns.flatMap(column => [column, originalRow[column]]),
			];
			pendingRowUpdate = { id: crypto.randomUUID(), query, parameters };
			void panel.webview.postMessage({
				type: 'rowUpdatePreview',
				confirmationId: pendingRowUpdate.id,
				sql: `${connection.format(query, parameters)};`,
			});
		} catch (error) {
			pendingRowUpdate = undefined;
			void panel.webview.postMessage({ type: 'rowUpdateError', message: errorMessage(error) });
		}
	}

	async function confirmRowUpdate(confirmationIdValue: unknown): Promise<void> {
		if (
			!connection ||
			typeof confirmationIdValue !== 'string' ||
			!pendingRowUpdate ||
			pendingRowUpdate.id !== confirmationIdValue
		) {
			void panel.webview.postMessage({
				type: 'rowUpdateError',
				message: 'The SQL preview has expired. Review the changes again.',
			});
			return;
		}
		const { query, parameters } = pendingRowUpdate;
		try {
			const [result] = await connection.query<ResultSetHeader>(query, parameters);
			if (result.affectedRows !== 1) {
				throw new Error('The row was not updated. It may have been changed or deleted.');
			}
			pendingRowUpdate = undefined;
			void panel.webview.postMessage({ type: 'rowUpdated' });
			await loadPage(
				currentRequest.page,
				currentRequest.pageSize,
				currentRequest.sort,
				currentRequest.filters,
			);
		} catch (error) {
			void panel.webview.postMessage({ type: 'rowUpdateError', message: errorMessage(error) });
		}
	}

	async function deleteRow(rowIdValue: unknown): Promise<void> {
		if (!connection || typeof rowIdValue !== 'string' || primaryKeyColumns.length === 0) {
			return;
		}
		const originalRow = pageRows.get(rowIdValue);
		if (!originalRow) {
			return;
		}
		const confirmation = await vscode.window.showWarningMessage(
			`Delete this row from “${database}.${table}”?`,
			{ modal: true },
			'Delete',
		);
		if (confirmation !== 'Delete') {
			return;
		}
		try {
			const whereClause = primaryKeyColumns.map(() => '?? <=> ?').join(' AND ');
			const parameters = [
				database,
				table,
				...primaryKeyColumns.flatMap(column => [column, originalRow[column]]),
			];
			const [result] = await connection.query<ResultSetHeader>(
				`DELETE FROM ??.?? WHERE ${whereClause} LIMIT 1`,
				parameters,
			);
			if (result.affectedRows !== 1) {
				throw new Error('The row was not deleted. It may have already been changed or deleted.');
			}
			await loadPage(
				currentRequest.page,
				currentRequest.pageSize,
				currentRequest.sort,
				currentRequest.filters,
			);
		} catch (error) {
			void vscode.window.showErrorMessage(`Could not delete row: ${errorMessage(error)}`);
		}
	}

	function previewInsertRow(valuesValue: unknown): void {
		if (
			!connection ||
			!valuesValue ||
			typeof valuesValue !== 'object' ||
			Array.isArray(valuesValue)
		) {
			return;
		}
		const insertableColumnNames = new Set(
			columnInfo
				.filter(column => column.editable && !column.autoIncrement)
				.map(column => column.name),
		);
		const values = parseRowChanges(valuesValue, insertableColumnNames, columnInfo);
		try {
			let query: string;
			let parameters: unknown[];
			if (values.length === 0) {
				query = 'INSERT INTO ??.?? () VALUES ()';
				parameters = [database, table];
			} else {
				const columnsClause = values.map(() => '??').join(', ');
				const valuesClause = values.map(() => '?').join(', ');
				query = `INSERT INTO ??.?? (${columnsClause}) VALUES (${valuesClause})`;
				parameters = [
					database,
					table,
					...values.map(value => value.column),
					...values.map(value => value.value),
				];
			}
			pendingRowInsert = { id: crypto.randomUUID(), query, parameters };
			void panel.webview.postMessage({
				type: 'rowInsertPreview',
				confirmationId: pendingRowInsert.id,
				sql: `${connection.format(query, parameters)};`,
			});
		} catch (error) {
			pendingRowInsert = undefined;
			void panel.webview.postMessage({ type: 'rowInsertError', message: errorMessage(error) });
		}
	}

	async function confirmRowInsert(confirmationIdValue: unknown): Promise<void> {
		if (
			!connection ||
			typeof confirmationIdValue !== 'string' ||
			!pendingRowInsert ||
			pendingRowInsert.id !== confirmationIdValue
		) {
			void panel.webview.postMessage({
				type: 'rowInsertError',
				message: 'The SQL preview has expired. Review the values again.',
			});
			return;
		}
		const { query, parameters } = pendingRowInsert;
		try {
			await connection.query(query, parameters);
			pendingRowInsert = undefined;
			void panel.webview.postMessage({ type: 'rowInserted' });
			await loadPage(
				currentRequest.page,
				currentRequest.pageSize,
				currentRequest.sort,
				currentRequest.filters,
			);
		} catch (error) {
			void panel.webview.postMessage({ type: 'rowInsertError', message: errorMessage(error) });
		}
	}
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
