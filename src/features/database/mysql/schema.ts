import { escapeId } from 'mysql2';
import type { SqliteTableColumnDefinition } from '@/features/database/protocol';

export const systemDatabases = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);

export function isSystemDatabase(name: string): boolean {
  return systemDatabases.has(name.toLowerCase());
}

export function buildMysqlCreateTableStatement(
  tableName: string,
  columns: readonly SqliteTableColumnDefinition[],
): string {
  if (!columns.length) throw new Error('A table must have at least one column.');
  const columnDefs = columns.map((col) => {
    const colName = escapeId(col.name);
    const colType = col.type.trim() || 'VARCHAR(255)';
    const notNull = col.notNull ? ' NOT NULL' : '';
    return `${colName} ${colType}${notNull}`;
  });

  const pks = columns.filter((c) => c.primaryKey).map((c) => escapeId(c.name));
  if (pks.length) {
    columnDefs.push(`PRIMARY KEY (${pks.join(', ')})`);
  }

  return `CREATE TABLE ${escapeId(tableName)} (\n  ${columnDefs.join(',\n  ')}\n)`;
}
