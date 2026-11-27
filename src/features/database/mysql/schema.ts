import { escapeId } from 'mysql2';
import type { DatabaseTableColumnDefinition } from '@/features/database/protocol';

export const quoteMysqlIdentifier = (name: string) => escapeId(name, true);

export const systemDatabases = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);

export function isSystemDatabase(name: string): boolean {
  return systemDatabases.has(name.toLowerCase());
}

export function buildMysqlCreateTableStatement(
  tableName: string,
  columns: readonly DatabaseTableColumnDefinition[],
): string {
  if (!columns.length) throw new Error('A table must have at least one column.');
  const columnDefs = columns.map((column) => mysqlColumnDefinition(column));

  const pks = columns.filter((c) => c.primaryKey).map((c) => quoteMysqlIdentifier(c.name));
  if (pks.length) {
    columnDefs.push(`PRIMARY KEY (${pks.join(', ')})`);
  }

  return `CREATE TABLE ${quoteMysqlIdentifier(tableName)} (\n  ${columnDefs.join(',\n  ')}\n)`;
}

export function mysqlColumnDefinition(column: DatabaseTableColumnDefinition, collation?: string): string {
  const type = column.type.trim();
  if (!/^(?:(?:tinyint|smallint|mediumint|int(?:eger)?|bigint|decimal|numeric|float|double)(?:\(\d+(?:,\s*\d+)?\))?(?: unsigned)?|(?:var)?char\(\d+\)|(?:datetime|timestamp|time)(?:\(\d+\))?|(?:tiny|medium|long)?(?:text|blob)|date|year|json|boolean|bool|bit(?:\(\d+\))?|(?:var)?binary\(\d+\))$/i.test(type)) {
    throw new Error(`Unsupported MySQL column type: ${type}`);
  }
  return `${quoteMysqlIdentifier(column.name)} ${type}${collation ? ` COLLATE ${quoteMysqlIdentifier(collation)}` : ''}${column.notNull || column.primaryKey ? ' NOT NULL' : ' NULL'}`;
}
