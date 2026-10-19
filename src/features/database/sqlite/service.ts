import * as path from 'node:path';
import * as vscode from 'vscode';
import { withSqliteFile } from './file-access';
import { runSqliteOperation } from './process-client';
import { RemoteSqliteClient } from './remote-client';
import type { SshService } from '@/features/ssh/ssh-service';
import type {
  CreateSqliteTableOptions,
  DatabaseDocument,
  DatabaseQueryResult,
  DatabaseRowMutation,
  DatabaseTable,
  DatabaseTableFilters,
  DatabaseTableCounts,
  UpdateSqliteTableSchemaOptions,
} from '@/features/database/protocol';
import { buildSqliteCreateTableStatement } from '@/features/database/sqlite-schema';
export const sqliteTableScheme = 'toolkit-sqlite-table';
let remoteClient: RemoteSqliteClient | undefined;

export function registerRemoteSqlite(ssh: SshService): vscode.Disposable {
  const client = new RemoteSqliteClient(ssh);
  remoteClient = client;
  return new vscode.Disposable(() => {
    if (remoteClient === client) remoteClient = undefined;
  });
}

function remote(uri: vscode.Uri): RemoteSqliteClient | undefined {
  if (uri.scheme !== 'toolkit-sftp') return undefined;
  if (!remoteClient) throw new Error('Remote SQLite is not available.');
  return remoteClient;
}

export function validateSqliteUri(uri: vscode.Uri): void {
  if (!['.db', '.sqlite'].includes(path.posix.extname(uri.path).toLowerCase())) {
    throw new Error('The SQLite editor supports .db and .sqlite files.');
  }
}

export async function readSqliteDatabase(uri: vscode.Uri): Promise<DatabaseDocument> {
  validateSqliteUri(uri);
  const client = remote(uri);
  if (client) return client.readDatabase(uri);
  return withSqliteFile(uri, 'read', (databasePath) => runSqliteOperation('readDatabase', [databasePath]));
}

export function createSqliteTableUri(databaseUri: vscode.Uri, tableName: string): vscode.Uri {
  return vscode.Uri.parse(
    `${sqliteTableScheme}:/table?database=${encodeURIComponent(databaseUri.toString())}&name=${encodeURIComponent(tableName)}`,
  );
}

export async function readSqliteTable(
  uri: vscode.Uri,
  filters?: DatabaseTableFilters,
  counts?: DatabaseTableCounts,
): Promise<DatabaseTable> {
  const { databaseUri, tableName } = parseSqliteTableUri(uri);
  const client = remote(databaseUri);
  if (client) return client.readTable(databaseUri, tableName, filters, counts);
  return withSqliteFile(databaseUri, 'read', (databasePath) =>
    runSqliteOperation('readFilteredTable', [databasePath, tableName, filters, counts]),
  );
}

export async function mutateSqliteTableRow(uri: vscode.Uri, mutation: DatabaseRowMutation): Promise<void> {
  const { databaseUri, tableName } = parseSqliteTableUri(uri);
  const client = remote(databaseUri);
  if (client) return client.mutateRow(databaseUri, tableName, mutation);
  await withSqliteFile(databaseUri, 'write', (databasePath) =>
    runSqliteOperation('mutateSqliteRow', [databasePath, tableName, mutation]),
  );
}

export function validateSqliteTableUri(uri: vscode.Uri): void {
  parseSqliteTableUri(uri);
}

export async function executeSqliteQuery(
  uri: vscode.Uri,
  sql: string,
  signal?: AbortSignal,
): Promise<DatabaseQueryResult> {
  validateSqliteUri(uri);
  if (!sql.trim()) throw new Error('SQL query is empty.');
  const client = remote(uri);
  if (client) return client.query(uri, sql, signal);
  return withSqliteFile(uri, 'write', (databasePath) =>
    runSqliteOperation('runSqliteQuery', [databasePath, sql], signal),
  );
}

export async function createSqliteTable(uri: vscode.Uri, options: CreateSqliteTableOptions): Promise<void> {
  validateSchemaOptions({ ...options, newTableName: options.tableName });
  await executeSqliteQuery(uri, buildSqliteCreateTableStatement({ ...options, tableName: options.tableName.trim() }));
}

export async function updateSqliteTableSchema(uri: vscode.Uri, options: UpdateSqliteTableSchemaOptions): Promise<void> {
  validateSqliteUri(uri);
  validateSchemaOptions(options);
  const client = remote(uri);
  if (client) return client.updateSchema(uri, options);
  await withSqliteFile(uri, 'write', (databasePath) =>
    runSqliteOperation('applySqliteTableSchema', [databasePath, options]),
  );
}

export async function deleteSqliteTable(uri: vscode.Uri, tableName: string): Promise<void> {
  validateSqliteUri(uri);
  if (!tableName.trim()) throw new Error('Table name is required.');
  const client = remote(uri);
  if (client) return client.deleteTable(uri, tableName);
  await withSqliteFile(uri, 'write', (databasePath) =>
    runSqliteOperation('applySqliteTableDeletion', [databasePath, tableName]),
  );
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
