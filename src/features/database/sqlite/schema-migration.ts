import { randomUUID } from 'node:crypto';
import type { UpdateSqliteTableSchemaOptions } from '@/features/database/protocol';
import { quoteIdentifier as quote } from '@/features/database/sqlite-schema';

export interface SqliteSchemaObject {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

interface Token {
  text: string;
  value: string;
  start: number;
  end: number;
}

// Keep original SQL fragments, including comments, expressions and conflict clauses.
function tokens(sql: string): Token[] {
  const result: Token[] = [];
  const pattern =
    /\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'|"(?:[^"]|"")*"|`(?:[^`]|``)*`|\[[^\]]*\]|[\p{L}_][\p{L}\p{N}_$]*|\d+(?:\.\d+)?|[^\s]/gu;
  for (const match of sql.matchAll(pattern)) {
    const text = match[0];
    if (/^(?:\s|--|\/\*)/.test(text)) continue;
    const first = text[0];
    const value = ['"', "'", '`', '['].includes(first) ? text.slice(1, -1).replaceAll(first + first, first) : text;
    result.push({ text, value, start: match.index, end: match.index + text.length });
  }
  return result;
}

function fail(message: string): never {
  throw new Error(`Cannot safely rebuild SQLite table: ${message}. Use an explicit SQL migration.`);
}

function keyword(token: Token | undefined, word: string): boolean {
  return token?.text.toUpperCase() === word;
}

function references(sql: string, names: Set<string>): boolean {
  return tokens(sql).some((token) => names.has(token.value.toLowerCase()));
}

function parseTable(sql: string): { parts: string[]; suffix: string } {
  const list = tokens(sql);
  if (!keyword(list[0], 'CREATE') || keyword(list[1], 'VIRTUAL')) fail('virtual or unrecognized table definition');
  const opening = list.findIndex((token) => token.text === '(');
  if (opening < 0) fail('table definition has no column list');
  let depth = 1;
  let start = list[opening].end;
  const parts: string[] = [];
  for (const token of list.slice(opening + 1)) {
    if (token.text === '(') depth++;
    if (token.text === ')') depth--;
    if ((token.text === ',' && depth === 1) || depth === 0) {
      parts.push(sql.slice(start, token.start).trim());
      start = token.end;
    }
    if (depth === 0) return { parts, suffix: sql.slice(token.end).replace(/;\s*$/, '') };
  }
  return fail('unbalanced table definition');
}

interface ColumnPart {
  name: string;
  type: string;
  clauses: string[];
}

function parseColumn(sql: string): ColumnPart {
  const list = tokens(sql);
  const starts: number[] = [];
  let depth = 0;
  for (let index = 1; index < list.length; index++) {
    const token = list[index];
    if (token.text === '(') depth++;
    if (token.text === ')') depth--;
    if (depth !== 0) continue;
    if (
      [
        'CONSTRAINT',
        'PRIMARY',
        'NOT',
        'NULL',
        'UNIQUE',
        'CHECK',
        'DEFAULT',
        'COLLATE',
        'REFERENCES',
        'GENERATED',
        'AS',
      ].some((word) => keyword(token, word))
    ) {
      // NOT NULL / PRIMARY KEY and REFERENCES actions belong to their clause.
      if (keyword(token, 'NULL') && (keyword(list[index - 1], 'NOT') || keyword(list[index - 1], 'DEFAULT'))) continue;
      if (keyword(token, 'NOT') && keyword(list[index + 1], 'DEFERRABLE')) continue;
      if (starts.length && keyword(list[starts.at(-1)!], 'CONSTRAINT') && index === starts.at(-1)! + 2) continue;
      if (
        keyword(token, 'AS') &&
        starts.length &&
        /GENERATED/i.test(sql.slice(list[starts.at(-1)!].start, token.start))
      )
        continue;
      if (
        ['NULL', 'DEFAULT'].some((word) => keyword(token, word)) &&
        ['SET'].some((word) => keyword(list[index - 1], word))
      )
        continue;
      starts.push(index);
    }
  }
  const first = starts.length ? list[starts[0]].start : sql.length;
  return {
    name: list[0].value,
    type: sql.slice(list[0].end, first).trim(),
    clauses: starts.map((index, position) =>
      sql.slice(list[index].start, position + 1 < starts.length ? list[starts[position + 1]].start : sql.length).trim(),
    ),
  };
}

function clauseKind(sql: string): string {
  const list = tokens(sql);
  return (keyword(list[0], 'CONSTRAINT') ? list[2] : list[0])?.text.toUpperCase() ?? '';
}

export function sqliteSchemaSnapshotQuery(): string {
  return 'SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name';
}

export function planSqliteSchemaMigration(
  objects: SqliteSchemaObject[],
  options: UpdateSqliteTableSchemaOptions,
): string[] {
  const original = objects.find((object) => object.type === 'table' && object.name === options.tableName);
  if (!original?.sql) fail(`table not found: ${options.tableName}`);
  if (!options.columns.length) fail('at least one column is required');
  if (!options.newTableName.trim() || options.newTableName.toLowerCase().startsWith('sqlite_'))
    fail('invalid target table name');
  if (
    options.newTableName !== options.tableName &&
    objects.some((object) => object.name.toLowerCase() === options.newTableName.toLowerCase())
  )
    fail('target name already exists');
  const parsed = parseTable(original.sql);
  const columns = new Map<string, ColumnPart>();
  const constraints: string[] = [];
  for (const part of parsed.parts) {
    if (['CONSTRAINT', 'PRIMARY', 'UNIQUE', 'CHECK', 'FOREIGN'].includes(tokens(part)[0]?.text.toUpperCase()))
      constraints.push(part);
    else {
      const column = parseColumn(part);
      columns.set(column.name, column);
    }
  }
  const used = new Set<string>();
  const names = new Set<string>();
  const definitions: string[] = [];
  const sources: string[] = [];
  const destinations: string[] = [];
  const renames: Array<[string, string]> = [];
  const pk = options.columns.filter((column) => column.primaryKey);
  const originalPk = [...columns.values()]
    .filter((column) => column.clauses.some((clause) => clauseKind(clause) === 'PRIMARY'))
    .map((column) => column.name);
  const tablePk = constraints.find((part) => clauseKind(part) === 'PRIMARY');
  if (tablePk) {
    const list = tokens(tablePk);
    const start = list.findIndex((token) => token.text === '(');
    for (let index = start + 1; index < list.length && list[index].text !== ')'; index++) {
      if (index === start + 1 || list[index - 1].text === ',') originalPk.push(list[index].value);
    }
  }
  const desiredPk = pk.map((column) => column.originalName ?? column.name);
  const pkChanged = originalPk.length !== desiredPk.length || originalPk.some((name) => !desiredPk.includes(name));
  if (pkChanged && tablePk && /\b(?:CONFLICT|DESC|ASC|COLLATE|CONSTRAINT)\b/i.test(tablePk))
    fail('changing a decorated table primary key');
  for (const column of options.columns) {
    const name = column.name.trim();
    if (!name || names.has(name.toLowerCase()) || name.includes('\0')) fail('invalid or duplicate column name');
    names.add(name.toLowerCase());
    const source = column.originalName ?? column.name;
    const existing = columns.get(source);
    if (!existing && column.originalName) fail(`column no longer exists: ${source}`);
    if (existing && used.has(source)) fail(`column used more than once: ${source}`);
    if (existing) used.add(source);
    const type = column.type?.trim() ?? '';
    if (type && !/^[\p{L}\p{N}_\s]+(?:\(\s*\d+\s*(?:,\s*\d+\s*)?\))?$/u.test(type))
      fail(`unsupported type for ${name}`);
    if (
      tokens(type).some((token) =>
        ['PRIMARY', 'NOT', 'UNIQUE', 'CHECK', 'DEFAULT', 'COLLATE', 'REFERENCES', 'CONSTRAINT', 'GENERATED', 'AS'].some(
          (word) => keyword(token, word),
        ),
      )
    )
      fail(`invalid type for ${name}`);
    let clauses = existing?.clauses ?? [];
    const oldNotNull = clauses.some((clause) => clauseKind(clause) === 'NOT');
    if (pkChanged) {
      if (clauses.some((clause) => /\bAUTOINCREMENT\b/i.test(clause))) fail('changing an AUTOINCREMENT primary key');
      clauses = clauses.filter((clause) => clauseKind(clause) !== 'PRIMARY');
    }
    if (oldNotNull !== column.notNull)
      clauses = clauses.filter((clause) => !['NOT', 'NULL'].includes(clauseKind(clause)));
    if (!oldNotNull && column.notNull) clauses = [...clauses, 'NOT NULL'];
    if (pkChanged && pk.length === 1 && column.primaryKey) clauses = [...clauses, 'PRIMARY KEY'];
    if (clauses.some((clause) => /\bAUTOINCREMENT\b/i.test(clause)) && type.toUpperCase() !== 'INTEGER')
      fail('AUTOINCREMENT requires INTEGER PRIMARY KEY');
    const intermediate = existing ? source : name;
    definitions.push(`${quote(intermediate)}${type ? ` ${type}` : ''} ${clauses.join(' ')}`.trim());
    if (existing && !clauses.some((clause) => ['AS', 'GENERATED'].includes(clauseKind(clause)))) {
      sources.push(quote(source));
      destinations.push(quote(intermediate));
    }
    if (existing && name !== source) renames.push([source, name]);
  }
  const removed = new Set([...columns.keys()].filter((name) => !used.has(name)).map((name) => name.toLowerCase()));
  // A single-column key belongs solely to that column; composite keys are dependencies.
  for (const constraint of constraints) {
    const list = tokens(constraint);
    const opening = list.findIndex((token) => token.text === '(');
    const closing = list.findIndex((token, index) => index > opening && token.text === ')');
    const keyColumns = list
      .slice(opening + 1, closing)
      .filter((token, index, entries) => index === 0 || entries[index - 1].text === ',');
    if (
      ['PRIMARY', 'UNIQUE'].includes(clauseKind(constraint)) &&
      keyColumns.length === 1 &&
      removed.has(keyColumns[0].value.toLowerCase())
    )
      continue;
    if (references(constraint, removed)) fail(`table constraint depends on a deleted column: ${constraint}`);
    if (!pkChanged || clauseKind(constraint) !== 'PRIMARY') definitions.push(constraint);
  }
  if (pkChanged && pk.length > 1) definitions.push(`PRIMARY KEY (${desiredPk.map(quote).join(', ')})`);
  for (const definition of definitions) {
    if (references(definition, removed)) fail('a retained column or constraint depends on a deleted column');
  }
  const layoutChanged =
    options.columns.length !== columns.size ||
    options.columns.some((column, index) => (column.originalName ?? column.name) !== [...columns.keys()][index]);
  for (const object of objects) {
    if (!object.sql || object === original) continue;
    if (pkChanged && object.type === 'table' && references(object.sql, new Set([options.tableName.toLowerCase()])))
      fail(`table ${object.name} may reference the original primary key`);
    if (
      references(object.sql, removed) &&
      (object.tbl_name === options.tableName || references(object.sql, new Set([options.tableName.toLowerCase()])))
    )
      fail(`${object.type} ${object.name} depends on a deleted column`);
    if (
      layoutChanged &&
      ['trigger', 'view'].includes(object.type) &&
      references(object.sql, new Set([options.tableName.toLowerCase()])) &&
      /\*|\bINSERT\b/i.test(object.sql)
    )
      fail(`${object.type} ${object.name} may depend on the original column layout`);
  }
  const withoutRowid = /\bWITHOUT\s+ROWID\b/i.test(parsed.suffix);
  const rowid = ['rowid', '_rowid_', 'oid'].find(
    (name) =>
      ![...columns.keys(), ...options.columns.map((column) => column.name)].some(
        (column) => column.toLowerCase() === name,
      ),
  );
  if (!withoutRowid && !rowid) fail('all rowid aliases are shadowed');
  const targetAlias = definitions
    .map((definition) => parseColumn(definition))
    .find(
      (column) =>
        column.type.toUpperCase() === 'INTEGER' &&
        column.clauses.some((clause) => clauseKind(clause) === 'PRIMARY' && !/\bDESC\b/i.test(clause)),
    );
  // Table-level INTEGER primary keys also alias rowid (including DESC).
  const alias =
    targetAlias?.name ??
    (desiredPk.length === 1 &&
    options.columns
      .find((column) => (column.originalName ?? column.name) === desiredPk[0])
      ?.type?.trim()
      .toUpperCase() === 'INTEGER' &&
    (tablePk || pkChanged)
      ? desiredPk[0]
      : undefined);
  const table = quote(options.tableName);
  const temporary = quote(`toolkit_rebuild_${randomUUID().replaceAll('-', '')}`);
  const guard = quote(`toolkit_schema_guard_${randomUUID().replaceAll('-', '')}`);
  const statements = [
    'PRAGMA foreign_keys = OFF',
    'PRAGMA legacy_alter_table = OFF',
    'BEGIN IMMEDIATE',
    `CREATE TEMP TABLE ${guard} (ok INTEGER CONSTRAINT "Schema changed, rowid cannot be preserved, or foreign key validation failed" CHECK (ok = 1))`,
    `INSERT INTO ${guard} SELECT CASE WHEN (${sqliteSchemaSnapshotQuery().replace('SELECT type, name, tbl_name, sql', 'SELECT count(*)').replace(' ORDER BY type, name', '')}) = ${objects.length} AND ${objects.map((object) => `EXISTS (SELECT 1 FROM sqlite_schema WHERE type = ${sqlLiteral(object.type)} AND name = ${sqlLiteral(object.name)} AND sql IS ${object.sql === null ? 'NULL' : sqlLiteral(object.sql)})`).join(' AND ')} THEN 1 ELSE 0 END`,
  ];
  if (!withoutRowid && alias) {
    if (!columns.has(alias)) fail('a new INTEGER primary key cannot safely preserve existing rowids');
    statements.push(
      `INSERT INTO ${guard} SELECT CASE WHEN EXISTS (SELECT 1 FROM ${table} WHERE ${quote(alias)} IS NOT ${quote(rowid!)}) THEN 0 ELSE 1 END`,
    );
  }
  if (!withoutRowid && !alias) {
    sources.unshift(quote(rowid!));
    destinations.unshift(quote(rowid!));
  }
  if (!sources.length) fail('no retained writable columns');
  const autoincrement = /\bAUTOINCREMENT\b/i.test(original.sql);
  const sequence = quote(`toolkit_sequence_${randomUUID().replaceAll('-', '')}`);
  if (autoincrement)
    statements.push(
      `CREATE TEMP TABLE ${sequence} AS SELECT seq FROM sqlite_sequence WHERE name = ${sqlLiteral(options.tableName)}`,
    );
  statements.push(
    `CREATE TABLE ${temporary} (${definitions.join(', ')})${parsed.suffix}`,
    `INSERT OR ABORT INTO ${temporary} (${destinations.join(', ')}) SELECT ${sources.join(', ')} FROM ${table}`,
    `DROP TABLE ${table}`,
    // Legacy mode prevents temporary invalid views from blocking the replacement rename.
    'PRAGMA legacy_alter_table = ON',
    `ALTER TABLE ${temporary} RENAME TO ${table}`,
    'PRAGMA legacy_alter_table = OFF',
  );
  if (autoincrement) {
    if (definitions.some((definition) => /\bAUTOINCREMENT\b/i.test(definition))) {
      statements.push(
        `UPDATE sqlite_sequence SET seq = max(seq, coalesce((SELECT max(seq) FROM ${sequence}), seq)) WHERE name = ${sqlLiteral(options.tableName)}`,
        `INSERT INTO sqlite_sequence (name, seq) SELECT ${sqlLiteral(options.tableName)}, seq FROM ${sequence} WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = ${sqlLiteral(options.tableName)})`,
      );
    }
    statements.push(`DROP TABLE ${sequence}`);
  }
  for (const object of objects) {
    if (object.tbl_name === options.tableName && ['index', 'trigger'].includes(object.type) && object.sql)
      statements.push(object.sql);
  }
  const stages = renames.map(([source, name]) => [source, name, `toolkit_column_${randomUUID().replaceAll('-', '')}`]);
  for (const [source, , stage] of stages)
    statements.push(`ALTER TABLE ${table} RENAME COLUMN ${quote(source)} TO ${quote(stage)}`);
  for (const [, name, stage] of stages)
    statements.push(`ALTER TABLE ${table} RENAME COLUMN ${quote(stage)} TO ${quote(name)}`);
  if (options.newTableName !== options.tableName)
    statements.push(`ALTER TABLE ${table} RENAME TO ${quote(options.newTableName)}`);
  statements.push(
    `INSERT INTO ${guard} SELECT CASE WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0 ELSE 1 END`,
    `DROP TABLE ${guard}`,
    'COMMIT',
    'PRAGMA foreign_keys = ON',
  );
  return statements;
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
