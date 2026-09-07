import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import * as vscode from 'vscode';
import type {
	DatabaseObject,
	NewRowValue,
	QueryResult,
	SqliteColumn,
	SqliteRequest,
	SqliteResponse,
	SqliteState,
	TableColumn,
} from './types';

const pageSize = 100;

type RowIdentity = {
	where: string;
	values: unknown[];
};

export class SqliteSession implements vscode.Disposable {
	private database: DatabaseSync | undefined;
	private state: SqliteState = {
		objects: [],
		selectedObject: null,
		columns: [],
		result: null,
		rowIdVisible: false,
		totalRows: 0,
		currentPage: 1,
		status: 'Opening database...',
	};
	private rowIdentities: RowIdentity[] = [];

	constructor(
		private readonly uri: vscode.Uri,
		private readonly postMessage: (message: SqliteResponse) => Thenable<boolean>,
	) {}

	async handleRequest(message: SqliteRequest): Promise<void> {
		if (message.type === 'ready') {
			await this.initialize();
			return;
		}
		if (!this.database) {
			throw new Error('Database is not ready.');
		}

		switch (message.type) {
			case 'openObject':
				this.openObject(message.object, message.page);
				await this.sendState();
				break;
			case 'createTable':
				await this.runOperation(message.requestId, () =>
					this.createTable(message.tableName, message.columns),
				);
				break;
			case 'updateTable':
				await this.runOperation(message.requestId, () =>
					this.updateTable(message.originalName, message.tableName, message.columns),
				);
				break;
			case 'updateRow':
				await this.runOperation(message.requestId, () =>
					this.updateRow(message.rowIndex, message.values),
				);
				break;
			case 'createRow':
				await this.runOperation(message.requestId, () =>
					this.createRow(message.tableName, message.values),
				);
				break;
			case 'deleteRow':
				await this.deleteRow(message.rowIndex);
				break;
			case 'deleteTable':
				await this.deleteTable(message.object);
				break;
		}
	}

	dispose(): void {
		if (this.database?.isOpen) this.database.close();
		this.database = undefined;
	}

	private async initialize(): Promise<void> {
		if (this.uri.scheme !== 'file') throw new Error('SQLite editing requires a local file.');
		if (this.database?.isOpen) this.database.close();
		this.database = new DatabaseSync(this.uri.fsPath);
		this.database.exec('PRAGMA busy_timeout = 5000');
		this.refreshObjects();
		this.state = { ...this.state, status: 'Database ready' };
		await this.sendState();
	}

	private refreshObjects(): void {
		const database = this.getDatabase();
		const rows = execute(
			database,
			"SELECT name, type FROM sqlite_schema WHERE type IN ('table', 'view') ORDER BY type, name",
		);
		const objects = rows.values.map(row => ({
			name: String(row[0]),
			type: row[1] as DatabaseObject['type'],
		}));
		const systemObjects: DatabaseObject[] = [
			{ name: 'sqlite_schema', type: 'view' },
			{ name: 'sqlite_temp_schema', type: 'view' },
		];
		this.state = {
			...this.state,
			objects: [
				...objects,
				...systemObjects.filter(system => !objects.some(object => object.name === system.name)),
			],
		};
	}

	private openObject(object: DatabaseObject, requestedPage = 1): void {
		const database = this.getDatabase();
		const columns = readColumns(database, object.name);
		const primaryKeyColumns = columns.filter(column => column.primaryKey);
		const count = Number(
			execute(database, `SELECT COUNT(*) FROM ${quoteIdentifier(object.name)}`).values[0]?.[0] ?? 0,
		);
		const pageCount = Math.ceil(count / pageSize);
		const currentPage = Math.max(1, Math.min(requestedPage, Math.max(1, pageCount)));
		const offset = (currentPage - 1) * pageSize;
		try {
			if (object.type !== 'table') throw new Error('Views do not expose rowid.');
			const rowIdAlias = getRowIdAlias(columns);
			if (!rowIdAlias) throw new Error('rowid is unavailable.');
			const data = execute(
				database,
				`SELECT ${quoteIdentifier(object.name)}.${rowIdAlias} AS __explorer_rowid__, * FROM ${quoteIdentifier(object.name)} LIMIT ? OFFSET ?`,
				[pageSize, offset],
			);
			const rowIdIndex = data.columns.indexOf('__explorer_rowid__');
			if (rowIdIndex < 0) throw new Error('rowid is unavailable.');
			this.rowIdentities = data.values.map(row => ({
				where: `${rowIdAlias} = ?`,
				values: [row[rowIdIndex]],
			}));
			this.state = {
				...this.state,
				selectedObject: object,
				columns,
				result: {
					columns: ['rowid', ...data.columns.filter((_, index) => index !== rowIdIndex)],
					values: data.values.map(row => [
						row[rowIdIndex],
						...row.filter((_, index) => index !== rowIdIndex),
					]),
				},
				rowIdVisible: true,
				totalRows: count,
				currentPage,
			};
		} catch {
			const data = execute(
				database,
				`SELECT * FROM ${quoteIdentifier(object.name)} LIMIT ? OFFSET ?`,
				[pageSize, offset],
			);
			this.rowIdentities = data.values.map(row =>
				createRowIdentity(primaryKeyColumns, data.columns, row),
			);
			this.state = {
				...this.state,
				selectedObject: object,
				columns,
				result: data,
				rowIdVisible: false,
				totalRows: count,
				currentPage,
			};
		}
	}

	private async createTable(tableName: string, columns: TableColumn[]): Promise<void> {
		const validationError = validateTable(tableName, columns, this.state.objects);
		if (validationError) throw new Error(validationError);
		this.getDatabase().exec(
			`CREATE TABLE ${quoteIdentifier(tableName)} (${columns.map(getColumnDefinition).join(', ')})`,
		);
		this.markSaved();
		this.refreshObjects();
		this.openObject({ name: tableName, type: 'table' });
	}

	private async updateTable(
		originalName: string,
		tableName: string,
		nextColumns: TableColumn[],
	): Promise<void> {
		const database = this.getDatabase();
		const currentColumns = readColumns(database, originalName);
		const validationError = validateTable(tableName, nextColumns, this.state.objects, originalName);
		if (validationError) throw new Error(validationError);
		const dependencies = execute(
			database,
			`SELECT type, name FROM sqlite_schema WHERE tbl_name = ? AND type IN ('index', 'trigger') AND sql IS NOT NULL`,
			[originalName],
		);
		const structureChanged =
			nextColumns.length !== currentColumns.length ||
			nextColumns.some((column, index) => {
				const current = currentColumns[index];
				return (
					!current ||
					column.originalName !== current.name ||
					column.name !== current.name ||
					column.type !== current.type ||
					column.primaryKey !== current.primaryKey ||
					column.notNull !== current.notNull ||
					column.defaultValue !== (current.defaultValue ?? '')
				);
			});
		if (structureChanged && dependencies.values.length)
			throw new Error("Remove this table's indexes and triggers before changing its columns.");

		if (!structureChanged) {
			if (tableName !== originalName)
				database.exec(
					`ALTER TABLE ${quoteIdentifier(originalName)} RENAME TO ${quoteIdentifier(tableName)}`,
				);
		} else {
			const temporaryName = `__explorer_${crypto.randomUUID().replaceAll('-', '')}`;
			const retainedColumns = nextColumns.filter(
				column =>
					column.originalName &&
					currentColumns.some(current => current.name === column.originalName),
			);
			database.exec('BEGIN');
			try {
				database.exec(
					`CREATE TABLE ${quoteIdentifier(temporaryName)} (${nextColumns.map(getColumnDefinition).join(', ')})`,
				);
				if (retainedColumns.length) {
					const targets = retainedColumns.map(column => quoteIdentifier(column.name)).join(', ');
					const sources = retainedColumns
						.map(column => quoteIdentifier(column.originalName!))
						.join(', ');
					database.exec(
						`INSERT INTO ${quoteIdentifier(temporaryName)} (${targets}) SELECT ${sources} FROM ${quoteIdentifier(originalName)}`,
					);
				}
				database.exec(`DROP TABLE ${quoteIdentifier(originalName)}`);
				database.exec(
					`ALTER TABLE ${quoteIdentifier(temporaryName)} RENAME TO ${quoteIdentifier(tableName)}`,
				);
				database.exec('COMMIT');
			} catch (error) {
				database.exec('ROLLBACK');
				throw error;
			}
		}
		this.markSaved();
		this.refreshObjects();
		this.openObject({ name: tableName, type: 'table' });
	}

	private async updateRow(rowIndex: number, values: unknown[]): Promise<void> {
		const object = this.state.selectedObject;
		const identity = this.rowIdentities[rowIndex];
		if (!object || !identity) throw new Error('This row cannot be identified for editing.');
		const assignments = this.state.columns
			.map(column => `${quoteIdentifier(column.name)} = ?`)
			.join(', ');
		run(
			this.getDatabase(),
			`UPDATE ${quoteIdentifier(object.name)} SET ${assignments} WHERE ${identity.where}`,
			[...values, ...identity.values],
		);
		this.markSaved();
		this.openObject(object, this.state.currentPage);
	}

	private async createRow(tableName: string, values: NewRowValue[]): Promise<void> {
		const database = this.getDatabase();
		if (values.length === 0) {
			database.exec(`INSERT INTO ${quoteIdentifier(tableName)} DEFAULT VALUES`);
		} else {
			const columnNames = values.map(item => quoteIdentifier(item.columnName)).join(', ');
			const placeholders = values.map(() => '?').join(', ');
			run(
				database,
				`INSERT INTO ${quoteIdentifier(tableName)} (${columnNames}) VALUES (${placeholders})`,
				values.map(item => item.value),
			);
		}
		this.markSaved();
		this.openObject(
			{ name: tableName, type: 'table' },
			this.state.selectedObject?.name === tableName ? this.state.currentPage : 1,
		);
	}

	private async deleteRow(rowIndex: number): Promise<void> {
		const object = this.state.selectedObject;
		const identity = this.rowIdentities[rowIndex];
		if (!object || !identity) throw new Error('This row cannot be identified for deletion.');
		const result = await vscode.window.showWarningMessage(
			`Delete this row from ${object.name}?`,
			{ modal: true },
			'Delete',
		);
		if (result !== 'Delete') return;
		const database = this.getDatabase();
		const changes = run(
			database,
			`DELETE FROM ${quoteIdentifier(object.name)} WHERE ${identity.where}`,
			identity.values,
		).changes;
		if (changes === 0 || changes === 0n)
			throw new Error('The row was not deleted because it could not be identified.');
		this.markSaved();
		this.openObject(object, this.state.currentPage);
		await this.sendState();
	}

	private async deleteTable(object: DatabaseObject): Promise<void> {
		if (object.type !== 'table' || isSystemTable(object)) return;
		const result = await vscode.window.showWarningMessage(
			`Delete table ${object.name}? All data in this table will be permanently removed.`,
			{ modal: true },
			'Delete',
		);
		if (result !== 'Delete') return;
		const database = this.getDatabase();
		database.exec(`DROP TABLE ${quoteIdentifier(object.name)}`);
		this.markSaved();
		this.refreshObjects();
		if (this.state.selectedObject?.name === object.name) {
			this.rowIdentities = [];
			this.state = {
				...this.state,
				selectedObject: null,
				columns: [],
				result: null,
				rowIdVisible: false,
				totalRows: 0,
				currentPage: 1,
			};
		}
		await this.sendState();
	}

	private async runOperation(requestId: string, operation: () => Promise<void>): Promise<void> {
		try {
			await operation();
			await this.postMessage({ type: 'operationResult', requestId });
			await this.sendState();
		} catch (error) {
			await this.postMessage({
				type: 'operationResult',
				requestId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private markSaved(): void {
		this.state = { ...this.state, status: 'Saved' };
	}

	private async sendState(): Promise<void> {
		await this.postMessage({ type: 'state', state: this.state });
	}

	private getDatabase(): DatabaseSync {
		if (!this.database) throw new Error('Database is not ready.');
		return this.database;
	}
}

function execute(database: DatabaseSync, sql: string, values: unknown[] = []): QueryResult {
	const statement = database.prepare(sql);
	statement.setReturnArrays(true);
	const rows = statement.all(...toSqlValues(values)) as unknown as unknown[][];
	return { columns: statement.columns().map(column => column.name), values: rows };
}

function run(database: DatabaseSync, sql: string, values: unknown[] = []) {
	return database.prepare(sql).run(...toSqlValues(values));
}

function toSqlValues(values: unknown[]): SQLInputValue[] {
	return values.map(value => (value === undefined ? null : (value as SQLInputValue)));
}

function quoteIdentifier(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

function readColumns(database: DatabaseSync, tableName: string): SqliteColumn[] {
	const schema = execute(database, `PRAGMA table_info(${quoteIdentifier(tableName)})`);
	return schema.values.map(row => ({
		name: String(row[1]),
		type: String(row[2] ?? ''),
		notNull: Boolean(row[3]),
		defaultValue: row[4] === null ? null : String(row[4]),
		primaryKey: Number(row[5]) > 0,
	}));
}

function validateTable(
	tableName: string,
	columns: TableColumn[],
	objects: DatabaseObject[],
	currentName?: string,
): string | undefined {
	if (!tableName) return 'Enter a table name.';
	if (
		objects.some(
			object =>
				object.name.toLowerCase() === tableName.toLowerCase() && object.name !== currentName,
		)
	)
		return 'A table or view with this name already exists.';
	if (!columns.length || columns.some(column => !column.name))
		return 'Every column must have a name.';
	const normalizedNames = columns.map(column => column.name.toLowerCase());
	if (new Set(normalizedNames).size !== normalizedNames.length)
		return 'Column names must be unique.';
	if (columns.filter(column => column.primaryKey).length > 1)
		return 'Only one column can be the primary key.';
	return undefined;
}

function getColumnDefinition(column: TableColumn): string {
	return [
		quoteIdentifier(column.name),
		column.type,
		column.primaryKey ? 'PRIMARY KEY' : '',
		column.notNull ? 'NOT NULL' : '',
		column.defaultValue.trim() ? `DEFAULT ${column.defaultValue.trim()}` : '',
	]
		.filter(Boolean)
		.join(' ');
}

function isSystemTable(object: DatabaseObject): boolean {
	return object.name.startsWith('sqlite_');
}

function getRowIdAlias(columns: SqliteColumn[]): 'rowid' | '_rowid_' | 'oid' | undefined {
	const columnNames = new Set(columns.map(column => column.name.toLowerCase()));
	return (['rowid', '_rowid_', 'oid'] as const).find(alias => !columnNames.has(alias));
}

function createRowIdentity(
	primaryKeyColumns: SqliteColumn[],
	columnNames: string[],
	row: unknown[],
): RowIdentity {
	const keyColumns = primaryKeyColumns.length
		? primaryKeyColumns
		: columnNames.map(name => ({ name }));
	return {
		where: keyColumns.map(column => `${quoteIdentifier(column.name)} IS ?`).join(' AND '),
		values: keyColumns.map(column => row[columnNames.indexOf(column.name)]),
	};
}
