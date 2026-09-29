import { mkdtemp, readFile, rm, writeFile as writeFileToDisk } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeSqliteQuery, readSqliteDatabase, validateSqliteUri } from './sqlite-service';

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
