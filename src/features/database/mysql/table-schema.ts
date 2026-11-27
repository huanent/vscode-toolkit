import type { Connection, RowDataPacket } from 'mysql2/promise';
import { mysqlColumnDefinition, quoteMysqlIdentifier as quote } from '@/features/database/mysql/schema';
import { readMysqlIndexes } from '@/features/database/mysql/table-index';
import type { UpdateTableSchemaOptions } from '@/features/database/protocol';

export async function updateMysqlTableSchema(connection: Connection, database: string, options: UpdateTableSchemaOptions): Promise<void> {
  const qualified = `${quote(database)}.${quote(options.tableName)}`;
  const [current] = await connection.query<RowDataPacket[]>(`SHOW FULL COLUMNS FROM ${qualified}`);
  const existing = new Map(current.map((column) => [String(column.Field), column]));
  if (options.originalColumns && (options.originalColumns.length !== current.length ||
    current.some(({ Field }) => !options.originalColumns?.includes(String(Field))))) {
    throw new Error('Table columns changed. Refresh and try again.');
  }
  const retained = new Set<string>();
  const targets = new Set<string>();
  const clauses: string[] = [];
  let keysChanged = false;
  const oldKeys = current.filter((column) => column.Key === 'PRI');
  const newKeys = options.columns.filter((column) => column.primaryKey);
  for (const column of options.columns) {
    const name = column.name.toLowerCase();
    if (targets.has(name)) throw new Error(`Duplicate column: ${column.name}`);
    targets.add(name);
    if (column.originalName === undefined) {
      clauses.push(`ADD COLUMN ${mysqlColumnDefinition(column)}`);
      continue;
    }
    const source = column.originalName;
    const previous = existing.get(source);
    if (!previous || retained.has(source)) throw new Error('Table columns changed. Refresh and try again.');
    retained.add(source);
    if ((previous.Key === 'PRI') !== column.primaryKey) keysChanged = true;
    const renamed = source !== column.name;
    if (renamed && [...existing.keys()].some((key) => key !== source && key.toLowerCase() === name)) {
      throw new Error(`Rename target ${column.name} is already in use. Rename the columns separately.`);
    }
    const modified = String(previous.Type).toLowerCase() !== column.type.toLowerCase() ||
      (previous.Null === 'NO') !== (column.notNull || column.primaryKey);
    if (modified) {
      if (previous.Default !== null || previous.Extra || previous.Comment) {
        throw new Error(`Cannot change ${source} without replacing attributes not supported by this editor. Use SQL for this change.`);
      }
      const collation = typeof previous.Collation === 'string' ? previous.Collation : undefined;
      const preserveCollation = collation && /^(?:(?:var)?char\(|(?:tiny|medium|long)?text$)/i.test(column.type);
      const definition = mysqlColumnDefinition(column, preserveCollation ? collation : undefined);
      clauses.push(`CHANGE COLUMN ${quote(source)} ${definition}`);
    } else if (renamed) {
      clauses.push(`RENAME COLUMN ${quote(source)} TO ${quote(column.name)}`);
    }
  }
  keysChanged ||= oldKeys.length !== newKeys.length || newKeys.some(({ originalName }) => !originalName);
  const removed = [...existing.keys()].filter((name) => !retained.has(name));
  if (removed.length) {
    const indexes = await readMysqlIndexes(connection, database, options.tableName);
    for (const name of removed) {
      if (indexes.some((index) => index.columns.includes(name) || index.readOnly && index.columns.includes('(expression)'))) {
        throw new Error(`Cannot remove ${name} while it has a dependent index. Remove the index first or use SQL.`);
      }
      clauses.push(`DROP COLUMN ${quote(name)}`);
    }
  }
  if (keysChanged && oldKeys.length) clauses.unshift('DROP PRIMARY KEY');
  if (keysChanged && newKeys.length) clauses.push(`ADD PRIMARY KEY (${newKeys.map(({ name }) => quote(name)).join(', ')})`);
  if (options.tableName !== options.newTableName) clauses.push(`RENAME TO ${quote(database)}.${quote(options.newTableName)}`);
  if (!clauses.length) return;
  const [engines] = await connection.execute<RowDataPacket[]>(
    'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [database, options.tableName]);
  if (engines[0]?.ENGINE !== 'InnoDB') throw new Error('Schema changes require an InnoDB table.');
  await connection.query(`ALTER TABLE ${qualified} ${clauses.join(', ')}`);
}
