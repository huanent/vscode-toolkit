import { DatabaseSync } from 'node:sqlite';
import type {
  DatabaseDocument,
  DatabaseQueryResult,
  DatabaseTable,
  UpdateSqliteTableSchemaOptions,
} from '@/features/database/protocol';
import { buildSqliteTableSchemaStatements, quoteIdentifier, sqliteTemporaryTablePrefix } from '@/features/database/sqlite-schema';

const maxPreviewRows = 100;
const maxPreviewColumns = 50;
const maxQueryResultRows = 1000;

export function applySqliteTableDeletion(databasePath: string, tableName: string): void {
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

export function applySqliteTableSchema(databasePath: string, options: UpdateSqliteTableSchemaOptions): void {
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

export function runSqliteQuery(databasePath: string, sql: string): DatabaseQueryResult {
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

export function readDatabase(databasePath: string): DatabaseDocument {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const tables = database
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND substr(name, 1, 7) <> 'sqlite_' ORDER BY name")
      .all()
      .map((row) => String(row.name));
    return { engine: 'sqlite', tables: tables.map((name) => readTable(database, name)) };
  } finally {
    database.close();
  }
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
  return { name, rowCount, columnCount: allColumns.length, columns, rows };
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
