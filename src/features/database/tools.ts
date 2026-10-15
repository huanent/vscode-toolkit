import * as vscode from 'vscode';
import type { DatabaseProvider } from '@/features/database/database-provider';
import type { AssetService } from '@/features/assets/service';

interface ExecuteSqlInput {
  id: string;
  database?: string;
  sql: string;
}

export function registerDatabaseTools(assets: AssetService, providers: readonly DatabaseProvider[]): vscode.Disposable {
  return vscode.lm.registerTool<ExecuteSqlInput>('sqlExecute', {
    prepareInvocation({ input }) {
      return {
        invocationMessage: `Executing SQL on database asset ${input.id}`,
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
        if (token.isCancellationRequested) controller.abort();
        const asset = await assets.requireAiAsset(input.id);
        const provider = providers.find((candidate) => candidate.type === asset.type);
        if (!provider) throw new Error(`Unsupported database asset type: ${asset.type}`);
        const result = await provider.executeAiQuery(asset.id, input.database, input.sql, controller.signal);
        return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(JSON.stringify(result))]);
      } finally {
        cancellation.dispose();
      }
    },
  });
}
