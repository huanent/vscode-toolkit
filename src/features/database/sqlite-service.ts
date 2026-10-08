import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import * as vscode from 'vscode';
import type {
  CreateSqliteTableOptions,
  DatabaseDocument,
  DatabaseQueryResult,
  DatabaseTable,
  UpdateSqliteTableSchemaOptions,
} from './protocol';
import {
  buildSqliteCreateTableStatement,
  buildSqliteTableSchemaStatements,
  quoteIdentifier,
  sqliteTemporaryTablePrefix,
} from './sqlite-schema';

const maxPreviewRows = 100;
const maxPreviewColumns = 50;
const maxQueryResultRows = 1000;
export const sqliteTableScheme = 'toolkit-sqlite-table';

export function validateSqliteUri(uri: vscode.Uri): void {
  if (!['.db', '.sqlite'].includes(path.posix.extname(uri.path).toLowerCase())) {
    throw new Error('The SQLite editor supports .db and .sqlite files.');
  }
}

export async function readSqliteDatabase(uri: vscode.Uri): Promise<DatabaseDocument> {
  validateSqliteUri(uri);
  if (uri.scheme === 'file') return readDatabase(uri.fsPath);

  const data = await vscode.workspace.fs.readFile(uri);
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'toolkit-sqlite-'));
  const temporaryPath = path.join(temporaryDirectory, path.posix.basename(uri.path) || 'database.sqlite');
  try {
    await writeFile(temporaryPath, data);
    return readDatabase(temporaryPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export function createSqliteTableUri(databaseUri: vscode.Uri, tableName: string): vscode.Uri {
  return vscode.Uri.parse(
    `${sqliteTableScheme}:/table?database=${encodeURIComponent(databaseUri.toString())}&name=${encodeURIComponent(tableName)}`,
  );
}

export async function readSqliteTable(uri: vscode.Uri): Promise<DatabaseTable> {
  const { databaseUri, tableName } = parseSqliteTableUri(uri);
  const database = await readSqliteDatabase(databaseUri);
  const table = database.tables.find((candidate) => candidate.name === tableName);
  if (!table) throw new Error(`SQLite table not found: ${tableName}`);
  return table;
}

export function validateSqliteTableUri(uri: vscode.Uri): void {
  parseSqliteTableUri(uri);
}

export async function executeSqliteQuery(uri: vscode.Uri, sql: string): Promise<DatabaseQueryResult> {
  validateSqliteUri(uri);
  if (!sql.trim()) throw new Error('SQL query is empty.');

  if (uri.scheme === 'file') {
    const file = await stat(uri.fsPath);
    if (!file.isFile()) throw new Error('The SQLite database URI must point to a file.');
    return runSqliteQuery(uri.fsPath, sql);
  }

  const originalData = await vscode.workspace.fs.readFile(uri);
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'toolkit-sqlite-'));
  const temporaryPath = path.join(temporaryDirectory, path.posix.basename(uri.path) || 'database.sqlite');
  try {
    await writeFile(temporaryPath, originalData);
    const result = runSqliteQuery(temporaryPath, sql);
    const updatedData = await readFile(temporaryPath);
    if (!Buffer.from(originalData).equals(updatedData)) await vscode.workspace.fs.writeFile(uri, updatedData);
    return result;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function createSqliteTable(uri: vscode.Uri, options: CreateSqliteTableOptions): Promise<void> {
  validateSchemaOptions({ ...options, newTableName: options.tableName });
  await executeSqliteQuery(uri, buildSqliteCreateTableStatement({ ...options, tableName: options.tableName.trim() }));
}

export async function updateSqliteTableSchema(uri: vscode.Uri, options: UpdateSqliteTableSchemaOptions): Promise<void> {
  validateSqliteUri(uri);
  validateSchemaOptions(options);

  if (uri.scheme === 'file') {
    const file = await stat(uri.fsPath);
    if (!file.isFile()) throw new Error('The SQLite database URI must point to a file.');
    applySqliteTableSchema(uri.fsPath, options);
    return;
  }

  const originalData = await vscode.workspace.fs.readFile(uri);
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'toolkit-sqlite-'));
  const temporaryPath = path.join(temporaryDirectory, path.posix.basename(uri.path) || 'database.sqlite');
  try {
    await writeFile(temporaryPath, originalData);
    applySqliteTableSchema(temporaryPath, options);
    const updatedData = await readFile(temporaryPath);
    if (!Buffer.from(originalData).equals(updatedData)) {
      await vscode.workspace.fs.writeFile(uri, updatedData);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function deleteSqliteTable(uri: vscode.Uri, tableName: string): Promise<void> {
  validateSqliteUri(uri);
  if (!tableName.trim()) throw new Error('Table name is required.');

  if (uri.scheme === 'file') {
    const file = await stat(uri.fsPath);
    if (!file.isFile()) throw new Error('The SQLite database URI must point to a file.');
    applySqliteTableDeletion(uri.fsPath, tableName);
    return;
  }

  const originalData = await vscode.workspace.fs.readFile(uri);
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'toolkit-sqlite-'));
  const temporaryPath = path.join(temporaryDirectory, path.posix.basename(uri.path) || 'database.sqlite');
  try {
    await writeFile(temporaryPath, originalData);
    applySqliteTableDeletion(temporaryPath, tableName);
    const updatedData = await readFile(temporaryPath);
    if (!Buffer.from(originalData).equals(updatedData)) {
      await vscode.workspace.fs.writeFile(uri, updatedData);
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

function validateSchemaOptions(options: UpdateSqliteTableSchemaOptions): void {
  const tableName = options.tableName?.trim();
  if (!tableName) throw new Error('Table name is required.');
  const newTableName = options.newTableName?.trim();
  if (!newTableName) throw new Error('New table name is required.');
  if (!options.columns || options.columns.length === 0) {
    throw new Error('The table must have at least one column.');
  }

  const seen = new Set<string>();
  for (const column of options.columns) {
    const name = column.name?.trim();
    if (!name) throw new Error('Column name cannot be empty.');
    const lower = name.toLowerCase();
    if (seen.has(lower)) throw new Error(`Duplicate column name: "${name}".`);
    seen.add(lower);
  }
}

function applySqliteTableDeletion(databasePath: string, tableName: string): void {
  const database = new DatabaseSync(databasePath);
  try {
    const tableExists = database
      .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?")
      .get(tableName);
    if (!tableExists) throw new Error(`SQLite table not found: ${tableName}`);
    database.exec(`DROP TABLE ${quoteIdentifier(tableName)}`);
  } finally {
    database.close();
  }
}

function applySqliteTableSchema(databasePath: string, options: UpdateSqliteTableSchemaOptions): void {
  const database = new DatabaseSync(databasePath);
  try {
    const tableExists = database
      .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?")
      .get(options.tableName);
    if (!tableExists) throw new Error(`SQLite table not found: ${options.tableName}`);

    if (options.newTableName !== options.tableName) {
      const targetExists = database
        .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?")
        .get(options.newTableName);
      if (targetExists) throw new Error(`Table already exists: ${options.newTableName}`);
    }

    const oldColumnRows = database.prepare(`PRAGMA table_info(${quoteIdentifier(options.tableName)})`).all();
    const oldColumnNames = oldColumnRows.map((row) => String(row.name));

    const tempName = `${sqliteTemporaryTablePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const statements = buildSqliteTableSchemaStatements(options, oldColumnNames, tempName);

    database.exec('PRAGMA foreign_keys = OFF');
    database.exec('BEGIN TRANSACTION');
    try {
      for (const statement of statements) database.exec(statement);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    } finally {
      database.exec('PRAGMA foreign_keys = ON');
    }
  } finally {
    database.close();
  }
}

function runSqliteQuery(databasePath: string, sql: string): DatabaseQueryResult {
  const database = new DatabaseSync(databasePath);
  try {
    const statement = database.prepare(sql);
    const columnMetadata = (statement as unknown as { columns?: () => Array<{ name: string }> }).columns;
    const columns =
      typeof columnMetadata === 'function' ? columnMetadata.call(statement).map((column) => column.name) : undefined;
    if (columns?.length) {
      statement.setReturnArrays(true);
      const rows: DatabaseQueryResult['rows'] = [];
      let rowCount = 0;
      const iterator = statement.iterate() as unknown as IterableIterator<unknown[]>;
      for (const row of iterator) {
        rowCount += 1;
        if (rows.length < maxQueryResultRows) rows.push(row.map(toDisplayValue));
      }
      return { hasResultSet: true, columns, rows, rowCount, truncated: rowCount > rows.length, changes: 0 };
    }

    if (columns === undefined && mayReturnRowsWithoutColumnMetadata(sql)) {
      const iterator = statement.iterate() as unknown as Iterator<Record<string, unknown>>;
      let next = iterator.next();
      const fallbackColumns = next.done ? [] : Object.keys(next.value);
      const rows: DatabaseQueryResult['rows'] = [];
      let rowCount = 0;
      while (!next.done) {
        rowCount += 1;
        if (rows.length < maxQueryResultRows) {
          rows.push(fallbackColumns.map((column) => toDisplayValue(next.value[column])));
        }
        next = iterator.next();
      }

      return {
        hasResultSet: true,
        columns: fallbackColumns,
        rows,
        rowCount,
        truncated: rowCount > rows.length,
        changes: 0,
      };
    }

    const result = statement.run();
    return {
      hasResultSet: false,
      columns: [],
      rows: [],
      rowCount: 0,
      truncated: false,
      changes: toQueryCount(result.changes),
      ...(/^\s*(?:INSERT|REPLACE)\b/i.test(sql) ? { lastInsertRowId: toQueryCount(result.lastInsertRowid) } : {}),
    };
  } finally {
    database.close();
  }
}

function mayReturnRowsWithoutColumnMetadata(sql: string): boolean {
  const normalized = sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(?:^|\s)--.*$/gm, ' ')
    .trim();
  return /^(?:SELECT|WITH|VALUES|PRAGMA|EXPLAIN)\b/i.test(normalized) || /\bRETURNING\b/i.test(normalized);
}

function readDatabase(databasePath: string): DatabaseDocument {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const tables = database
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND substr(name, 1, 7) <> 'sqlite_' ORDER BY name")
      .all()
      .map((row) => String(row.name));

    return {
      engine: 'sqlite',
      tables: tables.map((name) => readTable(database, name)),
    };
  } finally {
    database.close();
  }
}

function parseSqliteTableUri(uri: vscode.Uri): { databaseUri: vscode.Uri; tableName: string } {
  if (uri.scheme !== sqliteTableScheme) throw new Error('The SQLite table editor received an invalid URI.');
  const query = new URLSearchParams(uri.query);
  const database = query.get('database');
  const tableName = query.get('name');
  if (!database || !tableName) throw new Error('The SQLite table URI is missing database or table information.');
  const databaseUri = vscode.Uri.parse(database);
  validateSqliteUri(databaseUri);
  return { databaseUri, tableName };
}

function readTable(database: DatabaseSync, name: string): DatabaseTable {
  const quotedName = quoteIdentifier(name);
  const columnRows = database.prepare(`PRAGMA table_info(${quotedName})`).all();
  const allColumns = columnRows.map((row) => ({
    name: String(row.name),
    type: row.type == null ? '' : String(row.type),
    notNull: Number(row.notnull) !== 0,
    primaryKey: Number(row.pk) !== 0,
  }));
  const columns = allColumns.slice(0, maxPreviewColumns);
  const rowCount = Number(database.prepare(`SELECT COUNT(*) AS row_count FROM ${quotedName}`).get()?.row_count ?? 0);
  const selectedColumns = columns.length ? columns.map((column) => quoteIdentifier(column.name)).join(', ') : '*';
  const rows = database
    .prepare(`SELECT ${selectedColumns} FROM ${quotedName} LIMIT ?`)
    .all(maxPreviewRows)
    .map((row) => columns.map((column) => toDisplayValue(row[column.name])));

  return {
    name,
    rowCount,
    columnCount: allColumns.length,
    columns,
    rows,
  };
}

function toDisplayValue(value: unknown): string | number | null {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return `BLOB (${value.byteLength} bytes)`;
  if (value === undefined) return null;
  return String(value);
}

function toQueryCount(value: number | bigint): number | string {
  return typeof value === 'bigint' ? value.toString() : value;
}
