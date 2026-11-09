import {
  isDatabaseBooleanColumn,
  type DatabaseColumn,
  type DatabaseTableFilters,
} from '@/features/database/protocol';

export function buildTableFilter(
  columns: DatabaseColumn[],
  filters: DatabaseTableFilters | undefined,
  dialect: 'mysql' | 'sqlite',
): { where: string[]; parameters: string[]; active: boolean } {
  const where: string[] = [];
  const parameters: string[] = [];
  const quote = (name: string) =>
    dialect === 'mysql' ? `\`${name.replaceAll('`', '``')}\`` : `"${name.replaceAll('"', '""')}"`;
  function match(column: DatabaseColumn, value: string, exactNull = false): string {
    const name = quote(column.name);
    const filter = value.toLowerCase();
    if (exactNull && filter === 'null') return `${name} IS NULL`;
    if (isDatabaseBooleanColumn(column) && /^(?:true|false|0|1)$/.test(filter)) {
      parameters.push(filter === 'true' || filter === '1' ? '1' : '0');
      return `${name} = ?`;
    }
    const text = isDatabaseBooleanColumn(column)
      ? `CASE WHEN ${name} = 1 THEN 'true' WHEN ${name} = 0 THEN 'false' ELSE CAST(${name} AS ${dialect === 'mysql' ? 'CHAR' : 'TEXT'}) END`
      : `CAST(${name} AS ${dialect === 'mysql' ? 'CHAR' : 'TEXT'})`;
    parameters.push(`%${filter.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`);
    const like = `LOWER(${text}) LIKE ? ESCAPE ${dialect === 'mysql' ? 'CHAR(92)' : 'char(92)'}`;
    return filter === 'null' ? `(${like} OR ${name} IS NULL)` : like;
  }
  const search = filters?.search?.trim();
  if (search && columns.length) where.push(`(${columns.map((column) => match(column, search)).join(' OR ')})`);
  for (const [name, value] of Object.entries(filters?.columns ?? {})) {
    const column = columns.find((candidate) => candidate.name === name);
    if (column && value.trim()) where.push(match(column, value.trim(), true));
  }
  return { where, parameters, active: where.length > 0 };
}
