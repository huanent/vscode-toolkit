import * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import type { ResultTaskDefinition } from '@/features/result/task-service';
import { resultTaskService } from '@/features/result/task-service';
import type { DatabaseQueryInput, DatabaseQueryResult } from './protocol';
import { executeSqliteQuery } from './sqlite-service';
import { submitSqliteQuery } from './sqlite-result-service';

vi.mock('vscode', () => ({
  commands: { executeCommand: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined) },
}));
vi.mock('@/features/result/task-service', () => ({
  resultTaskService: { startTask: vi.fn<(...args: unknown[]) => Promise<string>>(async () => 'task-id') },
}));
vi.mock('./sqlite-service', () => ({
  executeSqliteQuery: vi.fn<(...args: unknown[]) => Promise<DatabaseQueryResult>>(async () => ({
    hasResultSet: true,
    columns: ['id'],
    rows: [[1]],
    rowCount: 1,
    truncated: false,
    changes: 0,
  })),
}));

describe('SQLite result service', () => {
  it('submits typed SQLite tasks to the shared result history', async () => {
    const databaseUri = { path: '/workspace/app.sqlite' } as vscode.Uri;
    const sql = 'SELECT * FROM items;';

    await submitSqliteQuery(databaseUri, sql);

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('toolkit.result.focus');
    const definition = vi.mocked(resultTaskService.startTask).mock.calls[0]![0] as ResultTaskDefinition<
      DatabaseQueryInput,
      DatabaseQueryResult
    >;
    expect(definition).toMatchObject({
      kind: 'sqlite',
      title: 'app.sqlite: SELECT * FROM items;',
      input: { databaseName: 'app.sqlite', sql },
    });
    const output: DatabaseQueryResult = {
      hasResultSet: true,
      columns: ['id'],
      rows: [[1]],
      rowCount: 1,
      truncated: false,
      changes: 0,
    };
    vi.mocked(executeSqliteQuery).mockResolvedValueOnce(output);
    await expect(definition.run(new AbortController().signal)).resolves.toEqual(output);
    expect(executeSqliteQuery).toHaveBeenCalledWith(databaseUri, sql);
  });
});
