import * as vscode from 'vscode';
import type { MysqlService } from './mysql-service';

interface ExecuteSqlInput {
  id: string;
  database?: string;
  sql: string;
}

export function registerDatabaseTools(mysql: MysqlService): vscode.Disposable {
  return vscode.lm.registerTool<ExecuteSqlInput>('sqlExecute', {
    prepareInvocation({ input }) {
      return {
        invocationMessage: `Executing SQL on MySQL asset ${input.id}`,
        confirmationMessages: {
          title: 'Execute SQL statement?',
          message: `Asset: ${input.id}${input.database ? `\nDatabase: ${input.database}` : ''}\nSQL: ${input.sql}`,
        },
      };
    },
    async invoke({ input }, token) {
      const controller = new AbortController();
      const cancellation = token.onCancellationRequested(() => controller.abort());
      try {
        const asset = await mysql.requireAsset(input.id);
        const result = await mysql.query(asset, input.database, input.sql, controller.signal);
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(result))]);
      } finally {
        cancellation.dispose();
      }
    },
  });
}
