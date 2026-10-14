import type { DatabaseCellValue, DatabaseColumn, DatabaseRowMutation } from '@/features/database/protocol';

export function buildRowMutation(
  tableName: string,
  columns: DatabaseColumn[],
  mutation: DatabaseRowMutation,
  dialect: 'sqlite' | 'mysql',
): { sql: string; parameters: DatabaseCellValue[]; where: string; keys: DatabaseCellValue[] } {
  const quote = (name: string) =>
    dialect === 'mysql' ? `\`${name.replaceAll('`', '``')}\`` : `"${name.replaceAll('"', '""')}"`;
  const entries = Object.entries(mutation.values);
  for (const [name, value] of entries) {
    const column = columns.find((candidate) => candidate.name === name);
    if (!column || column.readOnly) throw new Error(`Column cannot be written: ${name}`);
    if (value === null && column.notNull) throw new Error(`${name} cannot be NULL.`);
    if (
      typeof value === 'number' &&
      (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
    ) {
      throw new Error(`Unsafe numeric value for ${name}. Use a string instead.`);
    }
  }
  const keys: DatabaseCellValue[] = [];
  const primaryKeys = columns.filter((column) => column.primaryKey);
  if (mutation.operation !== 'create') {
    if (!primaryKeys.length) throw new Error('A primary key is required to edit or delete rows.');
    for (const column of primaryKeys) {
      const value = mutation.original?.[column.name];
      if (
        column.readOnly ||
        value == null ||
        (typeof value === 'number' &&
          (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))))
      ) {
        throw new Error(`Cannot safely identify this row by ${column.name}.`);
      }
      keys.push(value);
    }
  }
  const where = primaryKeys.map((column) => `${quote(column.name)} = ?`).join(' AND ');
  const table = quote(tableName);
  if (mutation.operation === 'create') {
    return {
      sql: entries.length
        ? `INSERT INTO ${table} (${entries.map(([name]) => quote(name)).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`
        : dialect === 'sqlite'
          ? `INSERT INTO ${table} DEFAULT VALUES`
          : `INSERT INTO ${table} () VALUES ()`,
      parameters: entries.map(([, value]) => value),
      where,
      keys,
    };
  }
  if (mutation.operation === 'delete')
    return { sql: `DELETE FROM ${table} WHERE ${where}`, parameters: keys, where, keys };
  if (!entries.length) throw new Error('No changes to save.');
  return {
    sql: `UPDATE ${table} SET ${entries.map(([name]) => `${quote(name)} = ?`).join(', ')} WHERE ${where}`,
    parameters: [...entries.map(([, value]) => value), ...keys],
    where,
    keys,
  };
}
