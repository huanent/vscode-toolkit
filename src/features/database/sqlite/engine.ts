import { DatabaseSync } from 'node:sqlite';
import {
  databaseTablePageSize,
  type DatabaseDocument,
  type DatabaseRowMutation,
  type DatabaseQueryResult,
  type DatabaseTable,
  type DatabaseTableFilters,
  type DatabaseTableCounts,
  type UpdateSqliteTableSchemaOptions,
} from '@/features/database/protocol';
import { quoteIdentifier } from '@/features/database/sqlite-schema';
import { buildRowMutation } from '@/features/database/row-mutation';

const maxPreviewColumns = 50;
const maxQueryResultRows = 1000;

export function mutateSqliteRow(databasePath: string, tableName: string, mutation: DatabaseRowMutation): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec('PRAGMA foreign_keys = ON');
    database.exec('BEGIN IMMEDIATE');
    try {
      const columns = database
        .prepare(`PRAGMA table_xinfo(${quoteIdentifier(tableName)})`)
        .all()
        .map((row) => ({
          name: String(row.name),
          type: String(row.type ?? ''),
          notNull: Number(row.notnull) !== 0,
          primaryKey: Number(row.pk) !== 0,
          readOnly: Number(row.hidden) !== 0 || /BLOB/i.test(String(row.type)),
        }));
      const statement = buildRowMutation(tableName, columns, mutation, 'sqlite');
      if (mutation.operation !== 'create') {
        const count = database
          .prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(tableName)} WHERE ${statement.where}`)
          .get(...statement.keys);
        if (Number(count?.count) !== 1)
          throw new Error('The row no longer exists or cannot be uniquely identified. Refresh and try again.');
      }
      const result = database.prepare(statement.sql).run(...statement.parameters);
      if (Number(result.changes) !== 1) throw new Error('The operation did not affect exactly one row.');
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  } finally {
    database.close();
  }
}

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

    database.exec('PRAGMA foreign_keys = ON');
    database.exec('PRAGMA legacy_alter_table = OFF');
    database.exec('BEGIN IMMEDIATE');
    try {
      const oldColumns = database.prepare(`PRAGMA table_xinfo(${quoteIdentifier(options.tableName)})`).all();
      if (oldColumns.length > maxPreviewColumns) {
        throw new Error('Tables with more than 50 columns require an explicit SQL migration.');
      }
      const retained = new Set<string>();
      const statements: string[] = [];
      const table = quoteIdentifier(options.tableName);
      let previousIndex = -1;
      let addedColumn = false;
      for (const column of options.columns) {
        const source = column.originalName ?? column.name;
        const index = oldColumns.findIndex((existing) => existing.name === source);
        if (index < 0) {
          if (column.originalName) throw new Error(`Column no longer exists: ${column.originalName}`);
          if (column.primaryKey) throw new Error('Adding a primary key requires an explicit SQL migration.');
          let definition = quoteIdentifier(column.name.trim());
          if (column.type?.trim()) definition += ` ${column.type.trim()}`;
          if (column.notNull) definition += ' NOT NULL';
          statements.push(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
          addedColumn = true;
          continue;
        }
        const existing = oldColumns[index];
        if (retained.has(source)) throw new Error(`Column is used more than once: ${source}`);
        if (index < previousIndex || addedColumn) {
          throw new Error('Reordering columns requires an explicit SQL migration.');
        }
        if (
          String(existing.type ?? '')
            .trim()
            .toUpperCase() !== (column.type ?? '').trim().toUpperCase() ||
          (Number(existing.pk) !== 0) !== column.primaryKey ||
          (Number(existing.notnull) !== 0) !== column.notNull
        ) {
          throw new Error('Changing column types, primary keys or nullability requires an explicit SQL migration.');
        }
        retained.add(source);
        previousIndex = index;
        if (source !== column.name.trim()) {
          statements.push(
            `ALTER TABLE ${table} RENAME COLUMN ${quoteIdentifier(source)} TO ${quoteIdentifier(column.name.trim())}`,
          );
        }
      }
      for (const column of oldColumns) {
        if (!retained.has(String(column.name))) {
          statements.push(`ALTER TABLE ${table} DROP COLUMN ${quoteIdentifier(String(column.name))}`);
        }
      }
      if (options.newTableName !== options.tableName) {
        statements.push(`ALTER TABLE ${table} RENAME TO ${quoteIdentifier(options.newTableName)}`);
      }
      for (const statement of statements) database.exec(statement);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  } finally {
    database.close();
  }
}

export function runSqliteQuery(databasePath: string, sql: string): DatabaseQueryResult {
  const database = new DatabaseSync(databasePath);
  try {
    const statement = database.prepare(sql);
    statement.setReadBigInts(true);
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
    return { engine: 'sqlite', tables: tables.map((name) => readTable(database, name, undefined, true)) };
  } finally {
    database.close();
  }
}

export function readFilteredTable(
  databasePath: string,
  tableName: string,
  filters?: DatabaseTableFilters,
  counts?: DatabaseTableCounts,
): DatabaseTable {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const exists = database.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(tableName);
    if (!exists) throw new Error(`SQLite table not found: ${tableName}`);
    return readTable(database, tableName, filters, false, counts);
  } finally {
    database.close();
  }
}

function readTable(
  database: DatabaseSync,
  name: string,
  filters?: DatabaseTableFilters,
  schemaOnly = false,
  counts?: DatabaseTableCounts,
): DatabaseTable {
  const quotedName = quoteIdentifier(name);
  const columnRows = database.prepare(`PRAGMA table_xinfo(${quotedName})`).all();
  const allColumns = columnRows.map((row) => ({
    name: String(row.name),
    type: row.type == null ? '' : String(row.type),
    notNull: Number(row.notnull) !== 0,
    primaryKey: Number(row.pk) !== 0,
    readOnly: Number(row.hidden) !== 0 || /BLOB/i.test(String(row.type)),
  }));
  const columns = allColumns.slice(0, maxPreviewColumns);
  if (schemaOnly) {
    return { name, rowCount: 0, rowCountKnown: false, columnCount: allColumns.length, columns: allColumns, rows: [] };
  }
  const { where, parameters, active } = buildTableFilter(columns, filters);
  const whereClause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const rowCount =
    counts?.rowCount ??
    Number(database.prepare(`SELECT COUNT(*) AS row_count FROM ${quotedName}`).get()?.row_count ?? 0);
  const filteredRowCount = active
    ? (counts?.filteredRowCount ??
      Number(
        database.prepare(`SELECT COUNT(*) AS row_count FROM ${quotedName}${whereClause}`).get(...parameters)
          ?.row_count ?? 0,
      ))
    : undefined;
  const selectedColumns = columns.length ? columns.map((column) => quoteIdentifier(column.name)).join(', ') : '*';
  const offset = (filters?.page ?? 0) * databaseTablePageSize;
  const statement = database.prepare(`SELECT ${selectedColumns} FROM ${quotedName}${whereClause} LIMIT ? OFFSET ?`);
  statement.setReadBigInts(true);
  const rows = statement
    .all(...parameters, databaseTablePageSize, offset)
    .map((row) => columns.map((column) => toDisplayValue(row[column.name])));
  return {
    name,
    rowCount,
    columnCount: allColumns.length,
    columns,
    rows,
    ...(filteredRowCount === undefined ? {} : { filteredRowCount }),
  };
}

function buildTableFilter(
  columns: DatabaseTable['columns'],
  filters?: DatabaseTableFilters,
): { where: string[]; parameters: string[]; active: boolean } {
  const where: string[] = [];
  const parameters: string[] = [];
  const searchableColumns = columns.map((column) => quoteIdentifier(column.name));
  const search = filters?.search?.trim();

  if (search) {
    const searchValue = toLikePattern(search);
    const matches = searchableColumns.map((column) => {
      parameters.push(searchValue);
      return search.toLowerCase() === 'null'
        ? `(LOWER(CAST(${column} AS TEXT)) LIKE ? ESCAPE char(92) OR ${column} IS NULL)`
        : `LOWER(CAST(${column} AS TEXT)) LIKE ? ESCAPE char(92)`;
    });
    if (matches.length) where.push(`(${matches.join(' OR ')})`);
  }

  for (const [name, value] of Object.entries(filters?.columns ?? {})) {
    const filter = value.trim();
    const column = columns.find((candidate) => candidate.name === name);
    if (!filter || !column) continue;
    const quotedColumn = quoteIdentifier(column.name);
    parameters.push(toLikePattern(filter));
    where.push(
      filter.toLowerCase() === 'null'
        ? `(LOWER(CAST(${quotedColumn} AS TEXT)) LIKE ? ESCAPE char(92) OR ${quotedColumn} IS NULL)`
        : `LOWER(CAST(${quotedColumn} AS TEXT)) LIKE ? ESCAPE char(92)`,
    );
  }

  return { where, parameters, active: where.length > 0 };
}

function toLikePattern(value: string): string {
  const escaped = value.toLowerCase().replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
  return `%${escaped}%`;
}

function toDisplayValue(value: unknown): string | number | null {
  if (value === null || typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'bigint') return toQueryCount(value);
  if (value instanceof Uint8Array) return `BLOB (${value.byteLength} bytes)`;
  if (value === undefined) return null;
  return String(value);
}

function toQueryCount(value: number | bigint): number | string {
  if (typeof value !== 'bigint') return value;
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(value)
    : value.toString();
}
