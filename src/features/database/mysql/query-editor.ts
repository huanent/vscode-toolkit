import type * as vscode from 'vscode';
import { registerQueryEditor } from '@/features/database/query-editor';
import { escapeId } from 'mysql2';
import type { MysqlConnectionConfiguration } from '@/features/database/protocol';
import type { ResultTaskService } from '@/features/result/task-service';
import type { MysqlService } from '@/features/database/mysql/service';

export const mysqlExecuteQueryCommand = 'toolkit.mysql.executeQuery';
export const mysqlQueryEditorContext = 'toolkit.mysqlQueryEditor';

export function registerMysqlQueryEditor(
  context: vscode.ExtensionContext,
  mysqlService: MysqlService,
  tasks: ResultTaskService,
): (asset: MysqlConnectionConfiguration, databaseName?: string, tableName?: string) => Promise<void> {
  return registerQueryEditor(context, tasks, {
    type: mysqlService.type,
    label: mysqlService.label,
    command: mysqlExecuteQueryCommand,
    contextKey: mysqlQueryEditorContext,
    requireAsset: (id) => mysqlService.requireAsset(id),
    query: (asset, database, sql, signal) => mysqlService.query(asset, database, sql, signal),
    initialQuery: createInitialQuery,
    databaseName: (asset, database) => database ?? asset.database ?? asset.name,
  });
}

function createInitialQuery(databaseName?: string, tableName?: string): string {
  const header = databaseName ? `-- Database: ${databaseName}\n` : '';
  if (!tableName) return header;
  return `${header}SELECT * FROM ${escapeId(tableName)} LIMIT 100;\n`;
}
