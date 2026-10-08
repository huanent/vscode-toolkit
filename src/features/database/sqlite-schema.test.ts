import { describe, expect, it } from 'vitest';
import { buildSqliteTableSchemaStatements } from './sqlite-schema';

describe('buildSqliteTableSchemaStatements', () => {
  it('rebuilds the table and copies columns mapped from the original table', () => {
    expect(
      buildSqliteTableSchemaStatements(
        {
          tableName: 'users',
          newTableName: 'accounts',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true, notNull: false, originalName: 'id' },
            { name: 'username', type: 'TEXT', primaryKey: false, notNull: true, originalName: 'name' },
            { name: 'email', type: 'TEXT', primaryKey: false, notNull: false },
          ],
        },
        ['id', 'name', 'age'],
        '__toolkit_temp',
      ),
    ).toEqual([
      'CREATE TABLE "__toolkit_temp" ("id" INTEGER PRIMARY KEY, "username" TEXT NOT NULL, "email" TEXT)',
      'INSERT INTO "__toolkit_temp" ("id", "username") SELECT "id", "name" FROM "users"',
      'DROP TABLE "users"',
      'ALTER TABLE "__toolkit_temp" RENAME TO "accounts"',
    ]);
  });

  it('skips the copy step when no column maps to the original table', () => {
    expect(
      buildSqliteTableSchemaStatements(
        {
          tableName: 'items',
          newTableName: 'items',
          columns: [{ name: 'note', type: 'TEXT', primaryKey: false, notNull: false }],
        },
        ['id'],
        '__toolkit_temp',
      ),
    ).toEqual([
      'CREATE TABLE "__toolkit_temp" ("note" TEXT)',
      'DROP TABLE "items"',
      'ALTER TABLE "__toolkit_temp" RENAME TO "items"',
    ]);
  });

  it('declares composite primary keys at table level and escapes identifiers', () => {
    expect(
      buildSqliteTableSchemaStatements(
        {
          tableName: 'odd " table',
          newTableName: 'odd " table',
          columns: [
            { name: 'a"b', type: 'INTEGER', primaryKey: true, notNull: false },
            { name: 'c', type: 'INTEGER', primaryKey: true, notNull: false },
          ],
        },
        [],
        '__toolkit_temp',
      ),
    ).toEqual([
      'CREATE TABLE "__toolkit_temp" ("a""b" INTEGER, "c" INTEGER, PRIMARY KEY ("a""b", "c"))',
      'DROP TABLE "odd "" table"',
      'ALTER TABLE "__toolkit_temp" RENAME TO "odd "" table"',
    ]);
  });
});
