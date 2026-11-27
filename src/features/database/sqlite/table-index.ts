import type { TableIndex, TableIndexChange } from '@/features/database/protocol';
import { quoteIdentifier } from '@/features/database/sqlite-schema';
import { requireEditableIndex, sameIndex } from '@/features/database/table-index';

interface SqliteIndex extends TableIndex {
  definition: string;
}

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

export function sqliteIndexQuery(table: string): string {
  return `SELECT i.name, i."unique" AS is_unique, s.sql AS definition, x.name AS column_name,
    i.origin <> 'c' OR i.partial OR x.cid < 0 OR x."desc" OR x.coll <> 'BINARY' AS advanced
    FROM pragma_index_list(${literal(table)}, 'main') i
    JOIN main.sqlite_schema s ON s.type = 'index' AND s.name = i.name
    JOIN pragma_index_xinfo(i.name, 'main') x ON x."key" = 1
    ORDER BY i.name, x.seqno`;
}

export function parseSqliteIndexes(rows: Record<string, unknown>[]): SqliteIndex[] {
  const indexes = new Map<string, SqliteIndex>();
  for (const row of rows) {
    const name = String(row.name);
    let index = indexes.get(name);
    if (!index) {
      index = { name, columns: [], unique: Boolean(row.is_unique), readOnly: !row.definition, definition: String(row.definition) };
      indexes.set(name, index);
    }
    index.columns.push(row.column_name === null ? '(expression)' : String(row.column_name));
    index.readOnly ||= Boolean(row.advanced);
  }
  return [...indexes.values()];
}

export function planSqliteIndexChange(table: string, change: TableIndexChange, indexes: SqliteIndex[]): string[] {
  const current = change.operation === 'create' ? undefined : requireEditableIndex(indexes, change.original);
  if (change.operation === 'update' && sameIndex(change.original, change.index)) return [];
  const statements = ['BEGIN IMMEDIATE', 'CREATE TEMP TABLE toolkit_index_guard (ok INTEGER CHECK (ok = 1))'];
  if (current) {
    statements.push(`INSERT INTO temp.toolkit_index_guard SELECT EXISTS (
      SELECT 1 FROM main.sqlite_schema WHERE type = 'index' AND tbl_name = ${literal(table)}
      AND name = ${literal(current.name)} AND sql = ${literal(current.definition)})`);
    statements.push(`DROP INDEX main.${quoteIdentifier(current.name)}`);
  }
  if (change.operation !== 'delete') {
    const { name, columns, unique } = change.index;
    for (const column of columns) {
      statements.push(`INSERT INTO temp.toolkit_index_guard SELECT EXISTS (
        SELECT 1 FROM pragma_table_xinfo(${literal(table)}, 'main') WHERE name = ${literal(column)} AND hidden <> 1)`);
    }
    statements.push(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX main.${quoteIdentifier(name)} ON ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')})`);
  }
  return [...statements, 'COMMIT'];
}
