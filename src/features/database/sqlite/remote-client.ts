import {
  planSqliteSchemaMigration,
  sqliteSchemaSnapshotQuery,
  type SqliteSchemaObject,
} from '@/features/database/sqlite/schema-migration';
import { randomUUID } from 'node:crypto';
import type * as vscode from 'vscode';
import type { SshService } from '@/features/ssh/ssh-service';
import {
  databaseTablePageSize,
  sqliteOverviewRowCountLimit,
  type DatabaseCellValue,
  type DatabaseColumn,
  type DatabaseDocument,
  type DatabaseQueryResult,
  type DatabaseRowMutation,
  type DatabaseTable,
  type DatabaseTableCounts,
  type DatabaseTableFilters,
  type UpdateSqliteTableSchemaOptions,
} from '@/features/database/protocol';
import { quoteIdentifier } from '@/features/database/sqlite-schema';
import { buildRowMutation } from '@/features/database/row-mutation';
import { buildTableFilter } from '@/features/database/table-filter';

type Row = Record<string, DatabaseCellValue>;

export class RemoteSqliteClient {
  constructor(private readonly ssh: SshService) {}

  private async execute(uri: vscode.Uri, statements: string[], write = false, signal?: AbortSignal): Promise<Row[][]> {
    const marker = `toolkit-${randomUUID()}`;
    for (const statement of statements) {
      if (/^\s*\./m.test(statement) || statement.includes('\0'))
        throw new Error('SQLite shell commands and NUL characters are not supported.');
    }
    const input = [
      '.bail on',
      '.timeout 5000',
      'PRAGMA foreign_keys = ON;',
      ...statements.flatMap((statement) => [`.print ${marker}`, `${statement}\n;`]),
      '',
    ].join('\n');
    const command = [
      'command -v sqlite3 >/dev/null 2>&1 || { printf "%s\\n" "Remote SQLite requires the sqlite3 command. Install sqlite3 on the SSH server." >&2; exit 127; }',
      `test -f ${shellArgument(uri.path)} || { printf "%s\\n" "The remote SQLite database does not exist or is not a regular file." >&2; exit 1; }`,
      `exec sqlite3 -batch -json ${write ? '' : '-readonly '}${shellArgument(uri.path)}`,
    ].join('\n');
    const result = await this.ssh.runCommand(
      uri.authority,
      command,
      AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(60000)]),
      undefined,
      input,
    );
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || 'Remote SQLite execution failed.');
    if (result.stdout.includes('[Output truncated at '))
      throw new Error('Remote SQLite result exceeds the SSH output limit. Select fewer rows or columns.');
    const chunks = result.stdout.split(`${marker}\n`);
    if (chunks.length !== statements.length + 1 || chunks[0]?.trim())
      throw new Error('Unexpected remote SQLite output. The sqlite3 command must support -json.');
    return chunks.slice(1).map((chunk) => {
      if (!chunk.trim()) return [];
      try {
        const rows: unknown = JSON.parse(chunk);
        if (!Array.isArray(rows) || !rows.every((row) => row !== null && typeof row === 'object'))
          throw new Error('Invalid rows');
        return rows as Row[];
      } catch {
        throw new Error('Invalid remote SQLite JSON output. Run one result-producing statement at a time.');
      }
    });
  }

  async readDatabase(uri: vscode.Uri): Promise<DatabaseDocument> {
    const [names] = await this.execute(uri, [
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND substr(name, 1, 7) <> 'sqlite_' ORDER BY name",
    ]);
    if (!names.length) return { engine: 'sqlite', tables: [] };
    const schemas = await this.execute(
      uri,
      names.flatMap((row) => {
        const table = quoteIdentifier(String(row.name));
        return [
          `PRAGMA table_xinfo(${table})`,
          `SELECT COUNT(*) AS count FROM (SELECT 1 FROM ${table} LIMIT ${sqliteOverviewRowCountLimit})`,
        ];
      }),
    );
    return {
      engine: 'sqlite',
      tables: names.map((row, index) => {
        const columns = readColumns(schemas[index * 2]);
        const rowCount = Number(schemas[index * 2 + 1][0].count);
        return {
          name: String(row.name),
          columns,
          columnCount: columns.length,
          rows: [],
          rowCount,
          rowCountCapped: rowCount === sqliteOverviewRowCountLimit,
        };
      }),
    };
  }

  async readTable(
    uri: vscode.Uri,
    tableName: string,
    filters?: DatabaseTableFilters,
    counts?: DatabaseTableCounts,
  ): Promise<DatabaseTable> {
    const columns = await this.columns(uri, tableName);
    const preview = columns.slice(0, 50);
    const filter = buildTableFilter(preview, filters, 'sqlite');
    let parameterIndex = 0;
    const conditions = filter.where.map((condition) =>
      condition.replace(/"(?:[^"]|"")*"|\?/g, (token) =>
        token === '?' ? literal(filter.parameters[parameterIndex++]) : token,
      ),
    );
    const table = quoteIdentifier(tableName);
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const offset = (filters?.page ?? 0) * databaseTablePageSize;
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid table page.');
    const selected = preview
      .map((column, index) => {
        const name = quoteIdentifier(column.name);
        return `CASE WHEN typeof(${name}) = 'blob' THEN 'BLOB (' || length(${name}) || ' bytes)' WHEN typeof(${name}) = 'integer' AND (${name} > 9007199254740991 OR ${name} < -9007199254740991) THEN CAST(${name} AS TEXT) ELSE ${name} END AS ${quoteIdentifier(`column_${index}`)}`;
      })
      .join(', ');
    const [total, filtered, rows] = await this.execute(uri, [
      counts ? `SELECT ${counts.rowCount} AS count` : `SELECT COUNT(*) AS count FROM ${table}`,
      conditions.length
        ? counts?.filteredRowCount === undefined
          ? `SELECT COUNT(*) AS count FROM ${table}${where}`
          : `SELECT ${counts.filteredRowCount} AS count`
        : 'SELECT 0 AS count',
      `SELECT ${selected} FROM ${table}${where} LIMIT ${databaseTablePageSize} OFFSET ${offset}`,
    ]);
    return {
      name: tableName,
      rowCount: Number(total[0].count),
      columnCount: columns.length,
      columns: preview,
      rows: rows.map((row) => preview.map((_, index) => row[`column_${index}`])),
      ...(conditions.length ? { filteredRowCount: Number(filtered[0].count) } : {}),
    };
  }

  async query(uri: vscode.Uri, sql: string, signal?: AbortSignal): Promise<DatabaseQueryResult> {
    const [rows, metadata] = await this.execute(
      uri,
      [sql, 'SELECT changes() AS changes, last_insert_rowid() AS lastInsertRowId'],
      true,
      signal,
    );
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const hasResultSet = rows.length > 0 || /^\s*(?:SELECT|WITH|VALUES|PRAGMA|EXPLAIN)\b/i.test(sql);
    return {
      hasResultSet,
      columns,
      rows: rows.slice(0, 1000).map((row) => columns.map((column) => row[column])),
      rowCount: rows.length,
      truncated: rows.length > 1000,
      changes: hasResultSet ? 0 : (metadata[0].changes ?? 0),
      ...(/^\s*(?:INSERT|REPLACE)\b/i.test(sql) ? { lastInsertRowId: metadata[0].lastInsertRowId ?? 0 } : {}),
    };
  }

  async mutateRow(uri: vscode.Uri, tableName: string, mutation: DatabaseRowMutation): Promise<void> {
    const columns = await this.columns(uri, tableName);
    const statement = buildRowMutation(tableName, columns, mutation, 'sqlite');
    let parameterIndex = 0;
    const bind = (sql: string, parameters: DatabaseCellValue[]) => {
      parameterIndex = 0;
      return sql.replace(/"(?:[^"]|"")*"|\?/g, (token) =>
        token === '?' ? literal(parameters[parameterIndex++]) : token,
      );
    };
    const checks =
      mutation.operation === 'create'
        ? []
        : [
            `INSERT INTO temp.toolkit_row_guard SELECT COUNT(*) FROM ${quoteIdentifier(tableName)} WHERE ${bind(statement.where, statement.keys)}`,
          ];
    await this.execute(
      uri,
      [
        'BEGIN IMMEDIATE',
        'CREATE TEMP TABLE toolkit_row_guard (count INTEGER CHECK (count = 1))',
        ...checks,
        bind(statement.sql, statement.parameters),
        'INSERT INTO temp.toolkit_row_guard VALUES (changes())',
        'COMMIT',
      ],
      true,
    );
  }

  async deleteTable(uri: vscode.Uri, tableName: string): Promise<void> {
    await this.columns(uri, tableName);
    await this.execute(uri, [`DROP TABLE ${quoteIdentifier(tableName)}`], true);
  }

  async updateSchema(uri: vscode.Uri, options: UpdateSqliteTableSchemaOptions): Promise<void> {
    const [objects] = await this.execute(uri, [sqliteSchemaSnapshotQuery()]);
    await this.execute(uri, planSqliteSchemaMigration(objects as unknown as SqliteSchemaObject[], options), true);
  }

  private async columns(uri: vscode.Uri, tableName: string): Promise<DatabaseColumn[]> {
    const [rows] = await this.execute(uri, [`PRAGMA table_xinfo(${quoteIdentifier(tableName)})`]);
    if (!rows.length) throw new Error(`SQLite table not found: ${tableName}`);
    return readColumns(rows);
  }
}

function readColumns(rows: Row[]): DatabaseColumn[] {
  return rows.map((row) => ({
    name: String(row.name),
    type: String(row.type ?? ''),
    notNull: Number(row.notnull) !== 0,
    primaryKey: Number(row.pk) !== 0,
    readOnly: Number(row.hidden) !== 0 || /BLOB/i.test(String(row.type)),
  }));
}

function literal(value: DatabaseCellValue): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Invalid numeric value.');
    return String(value);
  }
  return `CAST(X'${Buffer.from(value).toString('hex')}' AS TEXT)`;
}

function shellArgument(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
