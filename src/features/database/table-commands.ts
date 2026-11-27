import { getShortId } from '@/shared/short-id';
import * as vscode from 'vscode';
import { showOperationError } from '@/host/utils/show-operation-error';
import type { AssetService } from '@/features/assets/service';

interface TableContext {
  tableName: string;
  assetId?: string;
  databaseName?: string;
  databaseUri?: string;
  engine?: 'sqlite' | 'mysql' | 'postgresql';
  schemaName?: string;
}

function isTableContext(value: unknown): value is TableContext {
  if (typeof value !== 'object' || value === null) return false;
  const target = value as Partial<TableContext>;
  return (
    typeof target.tableName === 'string' &&
    (target.assetId === undefined || typeof target.assetId === 'string') &&
    (target.databaseName === undefined || typeof target.databaseName === 'string') &&
    (target.databaseUri === undefined || typeof target.databaseUri === 'string') &&
    (target.engine === undefined || ['sqlite', 'mysql', 'postgresql'].includes(target.engine)) &&
    (target.schemaName === undefined || typeof target.schemaName === 'string')
  );
}

export function registerTableCommands(context: vscode.ExtensionContext, assets: AssetService): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.database.copyTableName', async (target: unknown) => {
      if (!isTableContext(target)) return;
      try {
        await vscode.env.clipboard.writeText(target.tableName);
        void vscode.window.setStatusBarMessage('Table name copied to clipboard', 2000);
      } catch (error) {
        showOperationError(error);
      }
    }),
    vscode.commands.registerCommand('toolkit.database.copyAiReference', async (target: unknown) => {
      if (!isTableContext(target)) return;
      try {
        let reference: string;
        if (target.assetId && target.databaseName) {
          const assetId = target.assetId;
          const referenceId = getShortId(
            assetId,
            (await assets.list()).map((asset) => asset.id),
          );
          const schema = target.schemaName === undefined ? '' : `, schema: ${JSON.stringify(target.schemaName)}`;
          reference = `[Table ${JSON.stringify(target.tableName)}, database: ${JSON.stringify(target.databaseName)}${schema}, asset id: ${referenceId}, type: ${target.engine ?? 'mysql'}]`;
        } else if (target.databaseUri) {
          reference = `[Table ${JSON.stringify(target.tableName)}, database: ${JSON.stringify(vscode.Uri.parse(target.databaseUri).fsPath)}, type: sqlite]`;
        } else {
          return;
        }
        await vscode.env.clipboard.writeText(reference);
        void vscode.window.setStatusBarMessage('AI reference copied to clipboard', 2000);
      } catch (error) {
        showOperationError(error);
      }
    }),
  );
}
