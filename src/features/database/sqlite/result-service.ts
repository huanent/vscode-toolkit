import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ResultTaskService } from '@/features/result/task-service';
import type { DatabaseQueryInput, DatabaseQueryResult } from '@/features/database/protocol';
import { executeSqliteQuery } from './service';

export async function submitSqliteQuery(
  resultTaskService: ResultTaskService,
  databaseUri: vscode.Uri,
  sql: string,
): Promise<void> {
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
