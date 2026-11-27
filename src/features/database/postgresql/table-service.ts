import type { Client } from 'pg';
import {
  databaseTablePageSize,
  type CreateTableOptions,
  type DatabaseColumn,
  type DatabaseDocument,
  type DatabaseRowMutation,
  type DatabaseTable,
  type DatabaseTableColumnDefinition,
  type DatabaseTableCounts,
  type DatabaseTableFilters,
  type PostgresqlConnectionConfiguration,
  type TableIndexChange,
  type UpdateTableSchemaOptions,
} from '@/features/database/protocol';
import { normalizePostgresqlCell, type PostgresqlService } from '@/features/database/postgresql/service';
import {
  changePostgresqlIndex,
  qualifyPostgresqlIdentifier as qualified,
  quotePostgresqlIdentifier as quote,
  readPostgresqlIndexes,
  validatePostgresqlIdentifier as validateIdentifier,
} from '@/features/database/postgresql/table-index';
import { buildRowMutation } from '@/features/database/row-mutation';
import { buildTableFilter } from '@/features/database/table-filter';

interface CatalogColumn extends DatabaseColumn {
  tableName: string;
  identity: string;
  generated: string;
}

export class PostgresqlTableService {
  constructor(private readonly service: PostgresqlService) {}

  async readDatabase(asset: PostgresqlConnectionConfiguration, database?: string, schema?: string): Promise<DatabaseDocument> {
    return this.service.withConnection(asset, database, async (client) => {
      const { rows: databases } = await client.query<{ name: string }>(
        'SELECT datname AS name FROM pg_database WHERE datallowconn AND NOT datistemplate AND has_database_privilege(datname, \'CONNECT\') ORDER BY datname',
      );
      const { rows: schemas } = await client.query<{ name: string }>(
        "SELECT nspname AS name FROM pg_namespace WHERE left(nspname, 3) <> 'pg_' AND nspname <> 'information_schema' AND has_schema_privilege(oid, 'USAGE') ORDER BY nspname",
      );
      const { rows: [current] } = await client.query<{ database: string; schema: string | null }>(
        'SELECT current_database() AS database, current_schema() AS schema',
      );
      const names = schemas.map(({ name }) => name);
      const currentSchema = schema ?? (current.schema && names.includes(current.schema) ? current.schema : names[0]);
      if (currentSchema !== undefined && !names.includes(currentSchema)) throw new Error('Schema is not available.');
      const tables: DatabaseTable[] = [];
      if (currentSchema !== undefined) {
        const { rows } = await client.query<{ name: string }>(
          "SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind IN ('r', 'p') ORDER BY c.relname",
          [currentSchema],
        );
        const grouped = new Map<string, CatalogColumn[]>();
        for (const column of await readColumns(client, currentSchema)) {
          const columns = grouped.get(column.tableName);
          if (columns) columns.push(column);
          else grouped.set(column.tableName, [column]);
        }
        for (const { name } of rows) {
          const columns = grouped.get(name) ?? [];
          tables.push({ name, columns, columnCount: columns.length, rowCount: 0, rowCountKnown: false, rows: [] });
        }
      }
      return { engine: 'postgresql', databases: databases.map(({ name }) => name), currentDatabase: current.database,
        schemas: names, currentSchema, tables };
    });
  }

  async readTable(asset: PostgresqlConnectionConfiguration, database: string, schema: string, name: string,
    filters?: DatabaseTableFilters, counts?: DatabaseTableCounts): Promise<DatabaseTable> {
    return this.service.withConnection(asset, database, async (client) => {
      const columns = await requireColumns(client, schema, name);
      const table = qualified(schema, name);
      const { where, parameters, active } = buildTableFilter(columns, filters, 'postgresql');
      const clause = active ? ` WHERE ${where.join(' AND ')}` : '';
      const count = async (suffix = '', values: string[] = []) => {
        const { rows } = await client.query<{ count: string }>(`SELECT count(*) FROM ${table}${suffix}`, values);
        return Number(rows[0].count);
      };
      const rowCount = counts?.rowCount ?? await count();
      const filteredRowCount = active ? (counts?.filteredRowCount ?? await count(clause, parameters)) : undefined;
      const keys = columns.filter(({ primaryKey }) => primaryKey).map(({ name: key }) => quote(key));
      const order = keys.length ? ` ORDER BY ${keys.join(', ')}` : '';
      const page = filters?.page ?? 0;
      const offset = Math.min(page, Math.max(0, Math.ceil((filteredRowCount ?? rowCount) / databaseTablePageSize) - 1)) * databaseTablePageSize;
      const { rows } = await client.query<unknown[]>({
        text: `SELECT ${columns.map(({ name: column }) => quote(column)).join(', ')} FROM ${table}${clause}${order} LIMIT ${databaseTablePageSize} OFFSET ${offset}`,
        values: parameters, rowMode: 'array',
      });
      return { name, columns, columnCount: columns.length, rows: rows.map((row) => row.map(normalizePostgresqlCell)), rowCount, filteredRowCount };
    });
  }

  async mutateRow(asset: PostgresqlConnectionConfiguration, database: string, schema: string, name: string, mutation: DatabaseRowMutation): Promise<void> {
    await this.service.withConnection(asset, database, (client) => transaction(client, async () => {
      await client.query(`LOCK TABLE ${qualified(schema, name)} IN ROW EXCLUSIVE MODE`);
      const columns = await requireColumns(client, schema, name);
      if (mutation.operation !== 'create' && columns.some((column) => column.primaryKey && /date|time|real|double precision/i.test(column.type))) {
        throw new Error('Rows with temporal or floating-point primary keys cannot be safely edited here.');
      }
      const { sql, parameters } = buildRowMutation(name, columns, mutation, 'postgresql', schema);
      const result = await client.query(sql, parameters);
      if (result.rowCount !== 1) throw new Error('The operation did not affect exactly one row. Refresh and try again.');
    }));
  }

  async createTable(asset: PostgresqlConnectionConfiguration, database: string, schema: string, options: CreateTableOptions): Promise<void> {
    validateIdentifier(options.tableName);
    const keys = options.columns.filter(({ primaryKey }) => primaryKey).map(({ name }) => quote(name));
    const definitions = options.columns.map(columnDefinition);
    if (keys.length) definitions.push(`PRIMARY KEY (${keys.join(', ')})`);
    await this.service.withConnection(asset, database, async (client) => {
      await client.query(`CREATE TABLE ${qualified(schema, options.tableName)} (${definitions.join(', ')})`);
    });
  }

  async deleteTable(asset: PostgresqlConnectionConfiguration, database: string, schema: string, name: string): Promise<void> {
    await this.service.withConnection(asset, database, async (client) => {
      await client.query(`DROP TABLE ${qualified(schema, name)}`);
    });
  }

  async readIndexes(asset: PostgresqlConnectionConfiguration, database: string, schema: string, table: string) {
    return this.service.withConnection(asset, database, (client) => readPostgresqlIndexes(client, schema, table));
  }

  async changeIndex(asset: PostgresqlConnectionConfiguration, database: string, schema: string, table: string, change: TableIndexChange): Promise<void> {
    await this.service.withConnection(asset, database, (client) =>
      transaction(client, () => changePostgresqlIndex(client, schema, table, change)));
  }

  async updateTableSchema(asset: PostgresqlConnectionConfiguration, database: string, schema: string, options: UpdateTableSchemaOptions): Promise<void> {
    await this.service.withConnection(asset, database, (client) => transaction(client, async () => {
      const table = qualified(schema, options.tableName);
      await client.query(`LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE`);
      const current = await requireColumns(client, schema, options.tableName);
      if (options.originalColumns && (options.originalColumns.length !== current.length ||
        current.some(({ name }) => !options.originalColumns?.includes(name)))) {
        throw new Error('Table columns changed. Refresh and try again.');
      }
      const byName = new Map(current.map((column) => [column.name, column]));
      const sources = new Set<string>();
      const targets = new Set<string>();
      for (const column of options.columns) {
        validateIdentifier(column.name);
        if (targets.has(column.name)) throw new Error(`Duplicate column: ${column.name}`);
        targets.add(column.name);
        if (column.originalName === undefined) continue;
        if (sources.has(column.originalName) || !byName.has(column.originalName)) throw new Error('Table columns changed. Refresh and try again.');
        sources.add(column.originalName);
      }

      const oldKeys = current.filter(({ primaryKey }) => primaryKey).map(({ name }) => name);
      const newKeys = options.columns.filter(({ primaryKey }) => primaryKey);
      const keyChanged = oldKeys.length !== newKeys.length || newKeys.some(({ originalName }) => !originalName || !oldKeys.includes(originalName));
      if (keyChanged && oldKeys.length) {
        const { rows } = await client.query<{ name: string }>(
          "SELECT conname AS name FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'p'", [table],
        );
        if (rows.length !== 1) throw new Error('Could not identify the existing primary key.');
        await client.query(`ALTER TABLE ${table} DROP CONSTRAINT ${quote(rows[0].name)}`);
      }
      for (const column of current) {
        if (sources.has(column.name)) continue;
        const { rows } = await client.query<{ dependent: boolean }>(`SELECT EXISTS (
          SELECT 1 FROM pg_depend d JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
          WHERE d.refclassid = 'pg_class'::regclass AND d.refobjid = $1::regclass AND a.attname = $2
          AND d.classid IN ('pg_class'::regclass, 'pg_constraint'::regclass)
        ) AS dependent`, [table, column.name]);
        if (rows[0].dependent) throw new Error(`Cannot remove ${column.name} while it has a dependent index or constraint.`);
        await client.query(`ALTER TABLE ${table} DROP COLUMN ${quote(column.name)}`);
      }
      const staged = new Map<string, string>();
      let suffix = 0;
      for (const column of options.columns) {
        if (column.originalName === undefined || column.originalName === column.name) continue;
        let temporary: string;
        do temporary = `__toolkit_column_${++suffix}`; while (targets.has(temporary) || byName.has(temporary));
        staged.set(column.name, temporary);
        await client.query(`ALTER TABLE ${table} RENAME COLUMN ${quote(column.originalName)} TO ${quote(temporary)}`);
      }
      for (const column of options.columns) {
        if (column.originalName === undefined) {
          await client.query(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition(column)}`);
          continue;
        }
        const previous = byName.get(column.originalName)!;
        const stage = staged.get(column.name);
        if (stage) await client.query(`ALTER TABLE ${table} RENAME COLUMN ${quote(stage)} TO ${quote(column.name)}`);
        if (previous.type.toLowerCase() !== column.type.toLowerCase()) {
          if (previous.identity || previous.generated) throw new Error(`Cannot change the type of generated column ${column.name}.`);
          await client.query(`ALTER TABLE ${table} ALTER COLUMN ${quote(column.name)} TYPE ${columnType(column.type)}`);
        }
        if (previous.notNull !== (column.notNull || column.primaryKey)) {
          await client.query(`ALTER TABLE ${table} ALTER COLUMN ${quote(column.name)} ${column.notNull || column.primaryKey ? 'SET' : 'DROP'} NOT NULL`);
        }
      }
      if (keyChanged && newKeys.length) {
        await client.query(`ALTER TABLE ${table} ADD PRIMARY KEY (${newKeys.map(({ name }) => quote(name)).join(', ')})`);
      }
      if (options.tableName !== options.newTableName) {
        validateIdentifier(options.newTableName);
        await client.query(`ALTER TABLE ${table} RENAME TO ${quote(options.newTableName)}`);
      }
    }));
  }

  async createDatabase(asset: PostgresqlConnectionConfiguration, name: string, database?: string): Promise<void> {
    validateIdentifier(name);
    await this.service.withConnection(asset, database, async (client) => { await client.query(`CREATE DATABASE ${quote(name)}`); });
  }

  async deleteDatabase(asset: PostgresqlConnectionConfiguration, name: string): Promise<void> {
    if (['postgres', 'template0', 'template1'].includes(name)) throw new Error(`Cannot delete system database "${name}".`);
    await this.service.withConnection(asset, 'postgres', async (client) => { await client.query(`DROP DATABASE ${quote(name)}`); });
  }
}

async function readColumns(client: Client, schema: string, name?: string): Promise<CatalogColumn[]> {
  const { rows } = await client.query<CatalogColumn>(`SELECT c.relname AS "tableName", a.attname AS name,
    format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS "notNull",
    EXISTS (SELECT 1 FROM pg_constraint p WHERE p.conrelid = c.oid AND p.contype = 'p' AND a.attnum = ANY(p.conkey)) AS "primaryKey",
    a.attidentity AS identity, a.attgenerated AS generated
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND ($2::text IS NULL OR c.relname = $2) AND c.relkind IN ('r', 'p')
    AND a.attnum > 0 AND NOT a.attisdropped ORDER BY c.relname, a.attnum`, [schema, name ?? null]);
  return rows.map((column) => ({ ...column, readOnly: Boolean(column.generated || column.identity === 'a' || column.type === 'bytea' || column.type.endsWith('[]')) }));
}

async function requireColumns(client: Client, schema: string, name: string): Promise<CatalogColumn[]> {
  const columns = await readColumns(client, schema, name);
  if (!columns.length) throw new Error(`Table has no readable columns: ${schema}.${name}`);
  return columns;
}

function columnType(type: string): string {
  const normalized = type.trim();
  if (!/^(?:smallint|integer|bigint|text|boolean|date|timestamp(?: with(?:out)? time zone)?|uuid|jsonb?|bytea|real|double precision|(?:varchar|character varying)(?:\(\d+\))?|numeric(?:\(\d+(?:,\s*\d+)?\))?)$/i.test(normalized)) {
    throw new Error(`Unsupported PostgreSQL column type: ${type}`);
  }
  return normalized;
}

function columnDefinition(column: DatabaseTableColumnDefinition): string {
  validateIdentifier(column.name);
  return `${quote(column.name)} ${columnType(column.type)}${column.notNull ? ' NOT NULL' : ''}`;
}

async function transaction(client: Client, run: () => Promise<void>): Promise<void> {
  await client.query('BEGIN');
  try {
    await run();
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
