import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { escapeId } from 'mysql2';
import { createConnection, type Connection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import type {
  DatabaseColumn,
  DatabaseDocument,
  DatabaseQueryResult,
  DatabaseTable,
  MysqlConnectionConfiguration,
  SqliteTableColumnDefinition,
  UpdateTableSchemaMessage,
} from './protocol';
import type { AssetFormValues, AssetRequest, AssetViewEntry } from '@/features/assets/protocol';
import { AssetService, type AssetRecord } from '@/features/assets/service';
import type { AssetProvider } from '@/features/assets/asset-provider';
import type { ResultTaskService } from '@/features/result/task-service';
import { createMysqlUri, mysqlEditorViewType } from './mysql/editor';
import { buildMysqlCreateTableStatement, isSystemDatabase } from './mysql/schema';

export class MysqlService implements AssetProvider {
  readonly type = 'mysql';
  readonly label = 'MySQL';
  private readonly connections = new Set<Connection>();
  private readonly connectedAssets = new Set<string>();
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

  async saveConfiguration(values: AssetFormValues, record?: AssetRecord, parentId?: string): Promise<void> {
    const previous = record ? requireMysqlConfiguration(record) : undefined;
    const asset: MysqlConnectionConfiguration = {
      id: previous?.id ?? randomUUID(),
      type: 'mysql',
      parentId: record?.parentId ?? parentId,
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
  }

  invalidate(id?: string): void {
    if (id) this.connectedAssets.delete(id);
    else this.connectedAssets.clear();
  }

  toViewEntry(record: AssetRecord): AssetViewEntry {
    const asset = requireMysqlConfiguration(record);
    const connected = this.connectedAssets.has(asset.id);
    return {
      path: asset.id,
      name: asset.name,
      type: 'file',
      detail: `MySQL - ${asset.host}:${asset.port}`,
      context: { assetId: asset.id, assetType: this.type, assetConnected: connected },
    };
  }

  async execute(record: AssetRecord, request: AssetRequest): Promise<void> {
    const asset = requireMysqlConfiguration(record);
    if (request.action === 'connect') {
      await vscode.commands.executeCommand(
        'vscode.openWith',
        createMysqlUri(asset.id, asset.name),
        mysqlEditorViewType,
      );
    } else if (request.action === 'disconnect') {
      this.invalidate(asset.id);
    } else if (request.action === 'query') {
      await vscode.commands.executeCommand(
        'vscode.openWith',
        createMysqlUri(asset.id, asset.name),
        mysqlEditorViewType,
      );
    }
  }

  async requireAsset(id: string): Promise<MysqlConnectionConfiguration> {
    const record = await this.assets.get(id);
    return requireMysqlConfiguration(record);
  }

  async readDatabaseDocument(assetId: string, databaseName?: string): Promise<DatabaseDocument> {
    const asset = await this.requireAsset(assetId);
    return this.withConnection(asset, undefined, undefined, async (connection) => {
      this.connectedAssets.add(assetId);
      const [dbRows] = await connection.query<RowDataPacket[]>({ sql: 'SHOW DATABASES', timeout: 60000 });
      const databases = dbRows.map((row) => String(row.Database));

      let currentDatabase = databaseName && databases.includes(databaseName) ? databaseName : undefined;
      if (!currentDatabase && asset.database && databases.includes(asset.database)) {
        currentDatabase = asset.database;
      }
      if (!currentDatabase) {
        currentDatabase = databases.find((name) => !isSystemDatabase(name)) ?? databases[0];
      }

      if (!currentDatabase) {
        return {
          engine: 'mysql',
          databases,
          currentDatabase: undefined,
          tables: [],
        };
      }

      const [tableRows] = await connection.query<RowDataPacket[]>(
        {
          sql: 'SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
          timeout: 60000,
        },
        [currentDatabase],
      );

      const [columnRows] = await connection.query<RowDataPacket[]>(
        {
          sql: 'SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME, ORDINAL_POSITION',
          timeout: 60000,
        },
        [currentDatabase],
      );

      const columnsByTable = new Map<string, DatabaseColumn[]>();
      for (const row of columnRows) {
        const tableName = String(row.TABLE_NAME);
        const list = columnsByTable.get(tableName) ?? [];
        list.push({
          name: String(row.COLUMN_NAME),
          type: String(row.COLUMN_TYPE),
          notNull: row.IS_NULLABLE === 'NO',
          primaryKey: row.COLUMN_KEY === 'PRI',
        });
        columnsByTable.set(tableName, list);
      }

      const tables: DatabaseTable[] = tableRows.map((row) => {
        const name = String(row.TABLE_NAME);
        const cols = columnsByTable.get(name) ?? [];
        return {
          name,
          rowCount: Number(row.TABLE_ROWS ?? 0),
          columnCount: cols.length,
          columns: cols,
          rows: [],
        };
      });

      return {
        engine: 'mysql',
        databases,
        currentDatabase,
        tables,
      };
    });
  }

  async readTable(assetId: string, databaseName: string, tableName: string): Promise<DatabaseTable> {
    const asset = await this.requireAsset(assetId);
    return this.withConnection(asset, databaseName, undefined, async (connection) => {
      this.connectedAssets.add(assetId);
      const [colRows] = await connection.query<RowDataPacket[]>(
        {
          sql: 'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
          timeout: 60000,
        },
        [databaseName, tableName],
      );
      const columns: DatabaseColumn[] = colRows.map((col) => ({
        name: String(col.COLUMN_NAME),
        type: String(col.COLUMN_TYPE),
        notNull: col.IS_NULLABLE === 'NO',
        primaryKey: col.COLUMN_KEY === 'PRI',
      }));

      let rowCount = 0;
      try {
        const [countRows] = await connection.query<RowDataPacket[]>({
          sql: `SELECT COUNT(*) AS count FROM ${escapeId(tableName)}`,
          timeout: 60000,
        });
        rowCount = Number(countRows[0]?.count ?? 0);
      } catch {
        // Fallback to 0 if count query fails
      }

      const [rows] = await connection.query({
        sql: `SELECT * FROM ${escapeId(tableName)} LIMIT 1000`,
        rowsAsArray: true,
        timeout: 60000,
      });

      const values = (Array.isArray(rows) ? rows : []) as unknown as unknown[][];
      return {
        name: tableName,
        rowCount,
        columnCount: columns.length,
        columns,
        rows: values.map((row) =>
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
      };
    });
  }

  async createDatabase(assetId: string, databaseName: string): Promise<void> {
    const trimmed = databaseName.trim();
    if (!trimmed) throw new Error('Database name cannot be empty.');
    const asset = await this.requireAsset(assetId);
    await this.withConnection(asset, undefined, undefined, async (connection) => {
      await connection.query(`CREATE DATABASE ${escapeId(trimmed)}`);
    });
  }

  async deleteDatabase(assetId: string, databaseName: string): Promise<void> {
    const trimmed = databaseName.trim();
    if (!trimmed) throw new Error('Database name cannot be empty.');
    if (isSystemDatabase(trimmed)) throw new Error(`Cannot delete system database "${trimmed}".`);
    const asset = await this.requireAsset(assetId);
    await this.withConnection(asset, undefined, undefined, async (connection) => {
      await connection.query(`DROP DATABASE ${escapeId(trimmed)}`);
    });
  }

  async createTable(
    assetId: string,
    databaseName: string,
    options: { tableName: string; columns: readonly SqliteTableColumnDefinition[] },
  ): Promise<void> {
    const asset = await this.requireAsset(assetId);
    const sql = buildMysqlCreateTableStatement(options.tableName, options.columns);
    await this.withConnection(asset, databaseName, undefined, async (connection) => {
      await connection.query(sql);
    });
  }

  async deleteTable(assetId: string, databaseName: string, tableName: string): Promise<void> {
    const asset = await this.requireAsset(assetId);
    await this.withConnection(asset, databaseName, undefined, async (connection) => {
      await connection.query(`DROP TABLE ${escapeId(tableName)}`);
    });
  }

  async updateTableSchema(
    assetId: string,
    databaseName: string,
    options: UpdateTableSchemaMessage,
  ): Promise<void> {
    const asset = await this.requireAsset(assetId);
    await this.withConnection(asset, databaseName, undefined, async (connection) => {
      if (options.tableName !== options.newTableName) {
        await connection.query(`RENAME TABLE ${escapeId(options.tableName)} TO ${escapeId(options.newTableName)}`);
      }
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
    this.connectedAssets.clear();
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
