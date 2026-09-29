import * as path from 'node:path';
import * as vscode from 'vscode';
import { resultTaskService } from '@/features/result/task-service';
import type { DatabaseQueryInput, DatabaseQueryResult } from './protocol';
import { executeSqliteQuery } from './sqlite-service';

export async function submitSqliteQuery(databaseUri: vscode.Uri, sql: string): Promise<void> {
  await vscode.commands.executeCommand('toolkit.result.focus');
  const databaseName = path.posix.basename(databaseUri.path) || 'SQLite database';
  const querySummary = sql.replace(/\s+/g, ' ').trim();

  await resultTaskService.startTask<DatabaseQueryInput, DatabaseQueryResult>({
    kind: 'sqlite',
    title: `${databaseName}: ${querySummary.slice(0, 64)}${querySummary.length > 64 ? '...' : ''}`,
    input: { databaseName, sql },
    run: () => executeSqliteQuery(databaseUri, sql),
  });
}
