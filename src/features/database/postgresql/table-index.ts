import type { Client } from 'pg';
import type { TableIndex, TableIndexChange } from '@/features/database/protocol';
import { requireEditableIndex, sameIndex } from '@/features/database/table-index';

export const quotePostgresqlIdentifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
export const qualifyPostgresqlIdentifier = (schema: string, name: string) => `${quotePostgresqlIdentifier(schema)}.${quotePostgresqlIdentifier(name)}`;

export function validatePostgresqlIdentifier(name: string): void {
  if (!name.trim() || name.includes('\0') || Buffer.byteLength(name) > 63) throw new Error(`Invalid PostgreSQL identifier: ${name}`);
}

export async function readPostgresqlIndexes(client: Client, schema: string, table: string): Promise<TableIndex[]> {
  const { rows } = await client.query<TableIndex>(`SELECT idx.relname AS name, i.indisunique AS "unique",
    ARRAY(SELECT COALESCE(a.attname::text, '(expression)') FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, pos)
      LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum ORDER BY k.pos) AS columns,
    (am.amname <> 'btree' OR idx.relkind <> 'i' OR i.indisprimary OR i.indisexclusion OR NOT i.indisvalid
      OR NOT i.indisready OR NOT i.indislive OR i.indisclustered OR i.indisreplident OR NOT i.indimmediate
      OR i.indnkeyatts <> i.indnatts OR i.indexprs IS NOT NULL OR i.indpred IS NOT NULL
      OR idx.reloptions IS NOT NULL OR idx.reltablespace <> 0 OR obj_description(idx.oid, 'pg_class') IS NOT NULL
      OR COALESCE((to_jsonb(i)->>'indnullsnotdistinct')::boolean, false)
      OR EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = idx.oid)
      OR EXISTS (SELECT 1 FROM pg_inherits h WHERE h.inhrelid = idx.oid)
      OR EXISTS (SELECT 1 FROM unnest(i.indoption::smallint[], i.indclass::oid[], i.indcollation::oid[], i.indkey::smallint[]) AS k(opt, cls, coll, attnum)
        JOIN pg_opclass op ON op.oid = k.cls JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
        WHERE k.opt <> 0 OR NOT op.opcdefault OR k.coll <> a.attcollation)) AS "readOnly"
    FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class idx ON idx.oid = i.indexrelid JOIN pg_am am ON am.oid = idx.relam
    WHERE n.nspname = $1 AND t.relname = $2 AND t.relkind IN ('r', 'p') ORDER BY idx.relname`, [schema, table]);
  return rows;
}

export async function changePostgresqlIndex(client: Client, schema: string, table: string, change: TableIndexChange): Promise<void> {
  validatePostgresqlIdentifier(table);
  const qualified = qualifyPostgresqlIdentifier(schema, table);
  const quote = quotePostgresqlIdentifier;
  await client.query(`LOCK TABLE ${qualified} IN ACCESS EXCLUSIVE MODE`);
  if (change.operation !== 'create') {
    requireEditableIndex(await readPostgresqlIndexes(client, schema, table), change.original);
    if (change.operation === 'update' && sameIndex(change.original, change.index)) return;
    await client.query(`DROP INDEX ${qualifyPostgresqlIdentifier(schema, change.original.name)}`);
  }
  if (change.operation !== 'delete') {
    const { name, columns, unique } = change.index;
    validatePostgresqlIdentifier(name);
    columns.forEach(validatePostgresqlIdentifier);
    await client.query(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${quote(name)} ON ${qualified} (${columns.map(quote).join(', ')})`);
  }
}
