import type { Connection, RowDataPacket } from 'mysql2/promise';
import { quoteMysqlIdentifier as quote } from '@/features/database/mysql/schema';
import type { TableIndex, TableIndexChange } from '@/features/database/protocol';
import { requireEditableIndex, sameIndex } from '@/features/database/table-index';

export async function readMysqlIndexes(connection: Connection, database: string, table: string): Promise<TableIndex[]> {
  const [rows] = await connection.query<RowDataPacket[]>(`SHOW INDEX FROM ${quote(database)}.${quote(table)}`);
  const [foreignKeys] = await connection.execute<RowDataPacket[]>(`SELECT COLUMN_NAME, REFERENCED_COLUMN_NAME,
    TABLE_SCHEMA, TABLE_NAME, REFERENCED_TABLE_SCHEMA, REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE REFERENCED_TABLE_NAME IS NOT NULL AND ((TABLE_SCHEMA = ? AND TABLE_NAME = ?)
      OR (REFERENCED_TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME = ?))`, [database, table, database, table]);
  const constrained = new Set<string>();
  for (const row of foreignKeys) {
    if (row.TABLE_SCHEMA === database && row.TABLE_NAME === table) constrained.add(String(row.COLUMN_NAME));
    if (row.REFERENCED_TABLE_SCHEMA === database && row.REFERENCED_TABLE_NAME === table) constrained.add(String(row.REFERENCED_COLUMN_NAME));
  }
  const indexes = new Map<string, TableIndex>();
  for (const row of rows.sort((left, right) => Number(left.Seq_in_index) - Number(right.Seq_in_index))) {
    const name = String(row.Key_name);
    let index = indexes.get(name);
    if (!index) {
      index = { name, columns: [], unique: Number(row.Non_unique) === 0, readOnly: name === 'PRIMARY' };
      indexes.set(name, index);
    }
    const column = String(row.Column_name ?? '(expression)');
    index.columns.push(column);
    index.readOnly ||= !row.Column_name || row.Index_type !== 'BTREE' || row.Collation !== 'A' ||
      row.Sub_part != null || row.Expression != null || row.Visible === 'NO' || row.Ignored === 'YES' ||
      Boolean(row.Index_comment || row.Comment) || constrained.has(column);
  }
  return [...indexes.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function changeMysqlIndex(connection: Connection, database: string, table: string, change: TableIndexChange): Promise<void> {
  const qualified = `${quote(database)}.${quote(table)}`;
  const [engines] = await connection.execute<RowDataPacket[]>(
    'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?', [database, table]);
  if (engines[0]?.ENGINE !== 'InnoDB') throw new Error('Index changes require an InnoDB table.');
  const clauses: string[] = [];
  if (change.operation !== 'create') {
    requireEditableIndex(await readMysqlIndexes(connection, database, table), change.original);
    if (change.operation === 'update' && sameIndex(change.original, change.index)) return;
    clauses.push(`DROP INDEX ${quote(change.original.name)}`);
  }
  if (change.operation !== 'delete') {
    const { name, columns, unique } = change.index;
    clauses.push(`ADD ${unique ? 'UNIQUE ' : ''}INDEX ${quote(name)} (${columns.map(quote).join(', ')})`);
  }
  await connection.query(`ALTER TABLE ${qualified} ${clauses.join(', ')}`);
}
