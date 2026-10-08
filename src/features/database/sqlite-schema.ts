import type { CreateSqliteTableOptions, UpdateSqliteTableSchemaOptions } from './protocol';

export const sqliteTemporaryTablePrefix = '__toolkit_temp';

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

export function buildSqliteTableSchemaStatements(
  options: UpdateSqliteTableSchemaOptions,
  existingColumnNames: readonly string[],
  temporaryTableName: string,
): string[] {
  const mappings: Array<{ target: string; source: string }> = [];
  for (const col of options.columns) {
    const name = col.name.trim();
    const source =
      col.originalName && existingColumnNames.includes(col.originalName)
        ? col.originalName
        : existingColumnNames.includes(name)
          ? name
          : undefined;
    if (source) {
      mappings.push({ target: name, source });
    }
  }

  const temporaryTable = quoteIdentifier(temporaryTableName);
  const statements = [buildSqliteCreateTableStatement({ tableName: temporaryTableName, columns: options.columns })];
  if (mappings.length > 0) {
    const targets = mappings.map((m) => quoteIdentifier(m.target)).join(', ');
    const sources = mappings.map((m) => quoteIdentifier(m.source)).join(', ');
    statements.push(
      `INSERT INTO ${temporaryTable} (${targets}) SELECT ${sources} FROM ${quoteIdentifier(options.tableName)}`,
    );
  }
  statements.push(`DROP TABLE ${quoteIdentifier(options.tableName)}`);
  statements.push(`ALTER TABLE ${temporaryTable} RENAME TO ${quoteIdentifier(options.newTableName)}`);
  return statements;
}
