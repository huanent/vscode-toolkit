import { mkdtemp, readFile, rm, writeFile as writeFileToDisk } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteSqliteTable,
  executeSqliteQuery,
  readSqliteDatabase,
  updateSqliteTableSchema,
  validateSqliteUri,
} from './sqlite-service';

vi.mock('vscode', () => ({
  workspace: {
    fs: {
      readFile: vi.fn<(...args: unknown[]) => Promise<Uint8Array>>(),
      writeFile: vi.fn<(...args: unknown[]) => Promise<void>>(async () => undefined),
    },
  },
}));

describe('SQLite service', () => {
  let temporaryDirectory: string;

  beforeEach(async () => {
    vi.mocked(vscode.workspace.fs.readFile).mockReset();
    vi.mocked(vscode.workspace.fs.writeFile).mockReset();
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'toolkit-sqlite-test-'));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it.each(['/sample.db', '/sample.sqlite'])(`accepts %s files`, (filePath) => {
    expect(() => validateSqliteUri({ path: filePath } as vscode.Uri)).not.toThrow();
  });

  it('rejects unsupported extensions', () => {
    expect(() => validateSqliteUri({ path: '/sample.sqlite3' } as vscode.Uri)).toThrow(
      'The SQLite editor supports .db and .sqlite files.',
    );
  });

  it('reads schema and a bounded row preview from a local database', async () => {
    const databasePath = path.join(temporaryDirectory, 'sample.db');
    createSampleDatabase(databasePath);

    const document = await readSqliteDatabase({
      scheme: 'file',
      path: databasePath,
      fsPath: databasePath,
    } as vscode.Uri);

    expectPreview(document);
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('reads non-local database URIs through a temporary native SQLite file', async () => {
    const databasePath = path.join(temporaryDirectory, 'remote.sqlite');
    createSampleDatabase(databasePath);
    const uri = { scheme: 'vscode-remote', path: '/workspace/remote.sqlite' } as vscode.Uri;
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(await readFile(databasePath));

    const document = await readSqliteDatabase(uri);

    expectPreview(document);
    expect(vscode.workspace.fs.readFile).toHaveBeenCalledWith(uri);
  });

  it('returns query rows and persists local database changes', async () => {
    const databasePath = path.join(temporaryDirectory, 'query.db');
    createSampleDatabase(databasePath);
    const uri = { scheme: 'file', path: databasePath, fsPath: databasePath } as vscode.Uri;

    const selected = await executeSqliteQuery(uri, 'SELECT id, title FROM "odd "" table" WHERE id < 3 ORDER BY id');
    expect(selected).toEqual({
      hasResultSet: true,
      columns: ['id', 'title'],
      rows: [
        [1, 'row-0'],
        [2, 'row-1'],
      ],
      rowCount: 2,
      truncated: false,
      changes: 0,
    });

    const updated = await executeSqliteQuery(uri, 'UPDATE "odd "" table" SET title = \'updated\' WHERE id = 1');
    expect(updated.changes).toBe(1);
    expect(updated.hasResultSet).toBe(false);
    expect((await executeSqliteQuery(uri, 'SELECT title FROM "odd "" table" WHERE id = 1')).rows).toEqual([
      ['updated'],
    ]);
    const inserted = await executeSqliteQuery(uri, 'INSERT INTO "odd "" table" (title) VALUES (\'new\')');
    expect(inserted).toMatchObject({ hasResultSet: false, changes: 1, lastInsertRowId: 106 });
  });

  it('writes changes from non-local database URIs back through VS Code file access', async () => {
    const databasePath = path.join(temporaryDirectory, 'remote.sqlite');
    createSampleDatabase(databasePath);
    const uri = { scheme: 'vscode-remote', path: '/workspace/remote.sqlite' } as vscode.Uri;
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(await readFile(databasePath));

    const result = await executeSqliteQuery(uri, 'UPDATE "odd "" table" SET title = \'remote\' WHERE id = 1');

    expect(result.changes).toBe(1);
    expect(result.hasResultSet).toBe(false);
    expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(uri, expect.any(Uint8Array));
    const writtenData = vi.mocked(vscode.workspace.fs.writeFile).mock.calls[0]![1];
    const writtenDatabasePath = path.join(temporaryDirectory, 'written.sqlite');
    await writeFileToDisk(writtenDatabasePath, writtenData);
    const writtenUri = {
      scheme: 'file',
      path: writtenDatabasePath,
      fsPath: writtenDatabasePath,
    } as vscode.Uri;
    expect((await executeSqliteQuery(writtenUri, 'SELECT title FROM "odd "" table" WHERE id = 1')).rows).toEqual([
      ['remote'],
    ]);
  });

  it('updates table schema by renaming table and altering columns while preserving data', async () => {
    const databasePath = path.join(temporaryDirectory, 'schema.db');
    const database = new DatabaseSync(databasePath);
    database.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, age INTEGER)');
    database.exec("INSERT INTO users VALUES (1, 'Alice', 25), (2, 'Bob', 30)");
    database.close();

    const uri = { scheme: 'file', path: databasePath, fsPath: databasePath } as vscode.Uri;

    await updateSqliteTableSchema(uri, {
      tableName: 'users',
      newTableName: 'accounts',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, notNull: false, originalName: 'id' },
        { name: 'username', type: 'TEXT', primaryKey: false, notNull: true, originalName: 'name' },
        { name: 'email', type: 'TEXT', primaryKey: false, notNull: false },
      ],
    });

    const doc = await readSqliteDatabase(uri);
    expect(doc.tables).toHaveLength(1);
    const table = doc.tables[0]!;
    expect(table.name).toBe('accounts');
    expect(table.columns).toEqual([
      { name: 'id', type: 'INTEGER', primaryKey: true, notNull: false },
      { name: 'username', type: 'TEXT', primaryKey: false, notNull: true },
      { name: 'email', type: 'TEXT', primaryKey: false, notNull: false },
    ]);
    expect(table.rows).toEqual([
      [1, 'Alice', null],
      [2, 'Bob', null],
    ]);
  });

  it('validates table schema update options', async () => {
    const databasePath = path.join(temporaryDirectory, 'validation.db');
    const database = new DatabaseSync(databasePath);
    database.exec('CREATE TABLE items (id INTEGER PRIMARY KEY)');
    database.close();

    const uri = { scheme: 'file', path: databasePath, fsPath: databasePath } as vscode.Uri;

    await expect(
      updateSqliteTableSchema(uri, {
        tableName: '',
        newTableName: 'new_items',
        columns: [{ name: 'id', type: 'INTEGER', primaryKey: true, notNull: false }],
      }),
    ).rejects.toThrow('Table name is required.');

    await expect(
      updateSqliteTableSchema(uri, {
        tableName: 'items',
        newTableName: 'items',
        columns: [],
      }),
    ).rejects.toThrow('The table must have at least one column.');

    await expect(
      updateSqliteTableSchema(uri, {
        tableName: 'items',
        newTableName: 'items',
        columns: [
          { name: 'col', type: 'TEXT', primaryKey: false, notNull: false },
          { name: 'col', type: 'INTEGER', primaryKey: false, notNull: false },
        ],
      }),
    ).rejects.toThrow('Duplicate column name: "col".');

    await expect(
      updateSqliteTableSchema(uri, {
        tableName: 'non_existent',
        newTableName: 'new_name',
        columns: [{ name: 'id', type: 'INTEGER', primaryKey: true, notNull: false }],
      }),
    ).rejects.toThrow('SQLite table not found: non_existent');
  });

  it('updates table schema on remote database URIs and persists changes', async () => {
    const databasePath = path.join(temporaryDirectory, 'remote-schema.sqlite');
    const database = new DatabaseSync(databasePath);
    database.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, note TEXT)');
    database.exec("INSERT INTO test VALUES (1, 'hello')");
    database.close();

    const uri = { scheme: 'vscode-remote', path: '/workspace/remote-schema.sqlite' } as vscode.Uri;
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(await readFile(databasePath));

    await updateSqliteTableSchema(uri, {
      tableName: 'test',
      newTableName: 'test_updated',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, notNull: false, originalName: 'id' },
        { name: 'note', type: 'TEXT', primaryKey: false, notNull: false, originalName: 'note' },
        { name: 'extra', type: 'TEXT', primaryKey: false, notNull: false },
      ],
    });

    expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(uri, expect.any(Uint8Array));
  });

  it('deletes a table and its data from a local database', async () => {
    const databasePath = path.join(temporaryDirectory, 'delete.db');
    const database = new DatabaseSync(databasePath);
    database.exec('CREATE TABLE "odd "" table" (id INTEGER PRIMARY KEY)');
    database.exec('INSERT INTO "odd "" table" VALUES (1)');
    database.exec('CREATE TABLE keep (id INTEGER PRIMARY KEY)');
    database.close();
    const uri = { scheme: 'file', path: databasePath, fsPath: databasePath } as vscode.Uri;

    await deleteSqliteTable(uri, 'odd " table');

    expect((await readSqliteDatabase(uri)).tables.map((table) => table.name)).toEqual(['keep']);
  });

  it('deletes a table from a remote database and persists the changes', async () => {
    const databasePath = path.join(temporaryDirectory, 'remote-delete.sqlite');
    const database = new DatabaseSync(databasePath);
    database.exec('CREATE TABLE remove_me (id INTEGER PRIMARY KEY)');
    database.close();
    const uri = { scheme: 'vscode-remote', path: '/workspace/remote-delete.sqlite' } as vscode.Uri;
    vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(await readFile(databasePath));

    await deleteSqliteTable(uri, 'remove_me');

    expect(vscode.workspace.fs.writeFile).toHaveBeenCalledWith(uri, expect.any(Uint8Array));
    const writtenData = vi.mocked(vscode.workspace.fs.writeFile).mock.calls[0]![1];
    const writtenDatabasePath = path.join(temporaryDirectory, 'written-delete.sqlite');
    await writeFileToDisk(writtenDatabasePath, writtenData);
    const writtenUri = {
      scheme: 'file',
      path: writtenDatabasePath,
      fsPath: writtenDatabasePath,
    } as vscode.Uri;
    expect((await readSqliteDatabase(writtenUri)).tables).toEqual([]);
  });
});

function createSampleDatabase(databasePath: string): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec('CREATE TABLE "odd "" table" (id INTEGER PRIMARY KEY, title TEXT NOT NULL, payload BLOB)');
    const insert = database.prepare('INSERT INTO "odd "" table" (title, payload) VALUES (?, ?)');
    for (let index = 0; index < 105; index += 1) {
      insert.run(`row-${index}`, new Uint8Array([1, 2]));
    }
  } finally {
    database.close();
  }
}

function expectPreview(document: Awaited<ReturnType<typeof readSqliteDatabase>>): void {
  expect(document.engine).toBe('sqlite');
  expect(document.tables).toHaveLength(1);
  expect(document.tables[0]).toMatchObject({
    name: 'odd " table',
    rowCount: 105,
    columnCount: 3,
    columns: [
      { name: 'id', type: 'INTEGER', primaryKey: true },
      { name: 'title', type: 'TEXT', notNull: true },
      { name: 'payload', type: 'BLOB' },
    ],
  });
  expect(document.tables[0].rows).toHaveLength(100);
  expect(document.tables[0].rows[0]).toEqual([1, 'row-0', 'BLOB (2 bytes)']);
}
