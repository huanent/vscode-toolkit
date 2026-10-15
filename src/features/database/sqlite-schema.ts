import type { CreateSqliteTableOptions } from './protocol';

export function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function buildSqliteCreateTableStatement(options: CreateSqliteTableOptions): string {
  const pkCols = options.columns.filter((col) => col.primaryKey);
  const columnDefs = options.columns.map((col) => {
    let def = quoteIdentifier(col.name.trim());
    if (col.type?.trim()) def += ` ${col.type.trim()}`;
    if (pkCols.length === 1 && col.primaryKey) def += ' PRIMARY KEY';
    if (col.notNull) def += ' NOT NULL';
    return def;
  });
  if (pkCols.length > 1) {
    columnDefs.push(`PRIMARY KEY (${pkCols.map((col) => quoteIdentifier(col.name.trim())).join(', ')})`);
  }

  return `CREATE TABLE ${quoteIdentifier(options.tableName)} (${columnDefs.join(', ')})`;
}
