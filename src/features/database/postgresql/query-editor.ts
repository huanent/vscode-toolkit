import type * as vscode from 'vscode';
import { registerQueryEditor } from '@/features/database/query-editor';
import type { PostgresqlConnectionConfiguration } from '@/features/database/protocol';
import type { PostgresqlService } from '@/features/database/postgresql/service';
import type { ResultTaskService } from '@/features/result/task-service';

export function registerPostgresqlQueryEditor(
  context: vscode.ExtensionContext,
  service: PostgresqlService,
  tasks: ResultTaskService,
): (asset: PostgresqlConnectionConfiguration) => Promise<void> {
  return registerQueryEditor(context, tasks, {
    type: service.type,
    label: service.label,
    command: 'toolkit.postgresql.executeQuery',
    contextKey: 'toolkit.postgresqlQueryEditor',
    requireAsset: (id) => service.requireAsset(id),
    query: (asset, database, sql, signal) => service.query(asset, database, sql, signal),
    initialQuery: () => 'SELECT current_database();\n',
    databaseName: (asset, database) => database ?? asset.database ?? 'postgres',
  });
}
