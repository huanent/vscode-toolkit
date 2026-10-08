import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { escapeId } from 'mysql2';
import { createConnection, type Connection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import type { DatabaseQueryResult, DatabaseSchema, MysqlConnectionConfiguration } from './protocol';
import type { AssetFormValues, AssetRequest, AssetViewEntry } from '@/features/assets/protocol';
import { AssetService, type AssetRecord } from '@/features/assets/service';
import type { AssetProvider } from '@/features/assets/asset-provider';
import type { ResultTaskService } from '@/features/result/task-service';

export class MysqlService implements AssetProvider {
  readonly type = 'mysql';
  readonly label = 'MySQL';
  private readonly connections = new Set<Connection>();
  private readonly schemas = new Map<string, DatabaseSchema[]>();
  private disposed = false;

  constructor(
    private readonly assets: AssetService,
    private readonly tasks: ResultTaskService,
  ) {}

  getFormValues(record?: AssetRecord): AssetFormValues {
    const previous = record ? requireMysqlConfiguration(record) : undefined;
    return {
      name: previous?.name ?? 'MySQL',
      host: previous?.host ?? 'localhost',
      port: previous?.port ?? 3306,
      user: previous?.user ?? 'root',
      database: previous?.database ?? '',
      tls: previous?.tls ?? false,
      privateKeyPath: '',
      password: '',
    };
  }

  async saveConfiguration(values: AssetFormValues, record?: AssetRecord): Promise<void> {
    const previous = record ? requireMysqlConfiguration(record) : undefined;
    const asset: MysqlConnectionConfiguration = {
      id: previous?.id ?? randomUUID(),
      type: 'mysql',
      name: values.name.trim(),
      host: values.host.trim(),
      port: values.port,
      user: values.user.trim(),
      database: values.database.trim() || undefined,
      tls: values.tls,
    };
    requireMysqlConfiguration(asset);
    if (!asset.name || !asset.host || !asset.user) throw new Error('Name, host and user are required.');
    if (!previous || values.password !== '') await this.assets.setSecret(asset, values.password);
    await this.assets.save(asset);
    this.schemas.delete(asset.id);
  }

  invalidate(id?: string): void {
    if (id) this.schemas.delete(id);
    else this.schemas.clear();
  }

  toViewEntry(record: AssetRecord): AssetViewEntry {
    const asset = requireMysqlConfiguration(record);
    const databases = this.schemas.get(asset.id);
    const context = { assetId: asset.id, assetType: this.type, assetConnected: databases !== undefined };
    return {
      path: asset.id,
      name: asset.name,
      type: databases === undefined ? 'file' : 'directory',
      detail: `MySQL - ${asset.host}:${asset.port}`,
      context,
      children: databases?.map((database) => ({
        path: `${asset.id}/${encodeURIComponent(database.name)}`,
        name: database.name,
        type: 'directory',
        context: { ...context, assetDatabase: database.name },
        children: database.tables.map((table) => ({
          path: `${asset.id}/${encodeURIComponent(database.name)}/${encodeURIComponent(table)}`,
          name: table,
          type: 'file',
          context: { ...context, assetDatabase: database.name, assetTable: table },
        })),
      })),
    };
  }

  async execute(record: AssetRecord, request: AssetRequest): Promise<void> {
    const asset = requireMysqlConfiguration(record);
    if (request.action === 'connect') {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: `Connecting to ${asset.name}` },
        () => this.connect(asset),
      );
    } else if (request.action === 'disconnect') {
      this.invalidate(asset.id);
    } else if (request.action === 'query' || request.action === 'preview') {
      const sql =
        request.action === 'preview' && request.table
          ? `SELECT * FROM ${escapeId(request.table, true)} LIMIT 1000`
          : await vscode.window.showInputBox({
              title: `MySQL query: ${asset.name}`,
              prompt: request.database ?? asset.database,
              ignoreFocusOut: true,
              validateInput: (value) => (value.trim() ? undefined : 'Enter SQL.'),
            });
      if (!sql) return;
      await vscode.commands.executeCommand('toolkit.result.focus');
      await this.tasks.startTask({
        kind: this.type,
        title: `${asset.name}: ${sql.replace(/\s+/g, ' ').slice(0, 64)}`,
        input: { databaseName: request.database ?? asset.database ?? asset.name, sql },
        run: (signal) => this.query(asset, request.database, sql, signal),
      });
    }
  }

  async connect(asset: MysqlConnectionConfiguration): Promise<void> {
    await this.withConnection(asset, undefined, undefined, async (connection) => {
      const [rows] = await connection.query<RowDataPacket[]>({ sql: 'SHOW DATABASES', timeout: 60000 });
      const databases = [];
      for (const row of rows) {
        const name = String(row.Database);
        if (asset.database && name !== asset.database) continue;
        const [tables] = await connection.query<RowDataPacket[]>(
          {
            sql: 'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
            timeout: 60000,
          },
          [name],
        );
        databases.push({ name, tables: tables.map((table) => String(table.TABLE_NAME)) });
      }
      this.schemas.set(asset.id, databases);
    });
  }

  async query(
    asset: MysqlConnectionConfiguration,
    database: string | undefined,
    sql: string,
    signal: AbortSignal,
  ): Promise<DatabaseQueryResult> {
    return this.withConnection(asset, database, signal, async (connection) => {
      const [rows, fields] = await connection.query({ sql, rowsAsArray: true, timeout: 60000 });
      if (!Array.isArray(rows)) {
        const result = rows as ResultSetHeader;
        return {
          hasResultSet: false,
          columns: [],
          rows: [],
          rowCount: 0,
          truncated: false,
          changes: result.affectedRows,
          lastInsertRowId: result.insertId,
        };
      }
      const values = rows as unknown as unknown[][];
      return {
        hasResultSet: true,
        columns: fields.map((field) => field.name),
        rows: values
          .slice(0, 1000)
          .map((row) =>
            row.map((value) =>
              value === null
                ? null
                : typeof value === 'number' || typeof value === 'string'
                  ? value
                  : Buffer.isBuffer(value)
                    ? value.toString('hex')
                    : value instanceof Date
                      ? value.toISOString()
                      : JSON.stringify(value),
            ),
          ),
        rowCount: values.length,
        truncated: values.length > 1000,
        changes: 0,
      };
    });
  }

  dispose(): void {
    this.disposed = true;
    for (const connection of this.connections) connection.destroy();
    this.connections.clear();
    this.schemas.clear();
  }

  private async withConnection<T>(
    asset: MysqlConnectionConfiguration,
    database: string | undefined,
    signal: AbortSignal | undefined,
    run: (connection: Connection) => Promise<T>,
  ): Promise<T> {
    if (this.disposed || signal?.aborted) throw new Error('MySQL operation was cancelled.');
    const connection = await createConnection({
      host: asset.host,
      port: asset.port,
      user: asset.user,
      password: (await this.assets.getSecret(asset)) ?? '',
      database: database ?? asset.database,
      ssl: asset.tls ? { rejectUnauthorized: true } : undefined,
      connectTimeout: 10000,
      supportBigNumbers: true,
      bigNumberStrings: true,
      dateStrings: true,
      multipleStatements: false,
    });
    if (this.disposed || signal?.aborted) {
      connection.destroy();
      throw new Error('MySQL operation was cancelled.');
    }
    this.connections.add(connection);
    const abort = () => connection.destroy();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      return await run(connection);
    } finally {
      signal?.removeEventListener('abort', abort);
      this.connections.delete(connection);
      connection.destroy();
    }
  }
}

function isMysqlAsset(value: unknown): value is MysqlConnectionConfiguration {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Partial<MysqlConnectionConfiguration>;
  return (
    asset.type === 'mysql' &&
    typeof asset.id === 'string' &&
    /^[a-zA-Z0-9-]+$/.test(asset.id) &&
    typeof asset.name === 'string' &&
    typeof asset.host === 'string' &&
    typeof asset.user === 'string' &&
    typeof asset.port === 'number' &&
    Number.isInteger(asset.port) &&
    asset.port > 0 &&
    asset.port <= 65535 &&
    typeof asset.tls === 'boolean' &&
    (asset.database === undefined || typeof asset.database === 'string')
  );
}

function requireMysqlConfiguration(value: AssetRecord): MysqlConnectionConfiguration {
  if (!isMysqlAsset(value)) throw new Error(`Invalid MySQL configuration: ${value.name}`);
  return value;
}
