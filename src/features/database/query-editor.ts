import * as vscode from 'vscode';
import type { DatabaseQueryResult } from '@/features/database/protocol';
import type { ResultTaskService } from '@/features/result/task-service';

interface QueryEditorAsset {
  id: string;
  name: string;
  database?: string;
}

interface QueryEditorDefinition<TAsset extends QueryEditorAsset> {
  type: string;
  label: string;
  command: string;
  contextKey: string;
  requireAsset(id: string): Promise<TAsset>;
  query(asset: TAsset, database: string | undefined, sql: string, signal: AbortSignal): Promise<DatabaseQueryResult>;
  initialQuery(database?: string, table?: string): string;
  databaseName(asset: TAsset, database?: string): string;
}

export function registerQueryEditor<TAsset extends QueryEditorAsset>(
  context: vscode.ExtensionContext,
  tasks: ResultTaskService,
  definition: QueryEditorDefinition<TAsset>,
): (asset: TAsset, database?: string, table?: string) => Promise<void> {
  const targets = new WeakMap<vscode.TextDocument, { assetId: string; database?: string }>();
  const updateContext = (document?: vscode.TextDocument) =>
    vscode.commands.executeCommand('setContext', definition.contextKey, Boolean(document && targets.has(document)));
  context.subscriptions.push(
    vscode.commands.registerCommand(definition.command, async () => {
      const editor = vscode.window.activeTextEditor;
      const target = editor && targets.get(editor.document);
      if (!editor || !target) return;
      const sql = (
        editor.selection.isEmpty ? editor.document.getText() : editor.document.getText(editor.selection)
      ).trim();
      if (!sql) {
        void vscode.window.showWarningMessage('No SQL query to execute.');
        return;
      }
      try {
        const asset = await definition.requireAsset(target.assetId);
        await vscode.commands.executeCommand('toolkit.result.focus');
        await tasks.startTask({
          kind: definition.type,
          title: `${asset.name}: ${sql.replace(/\s+/g, ' ').slice(0, 64)}`,
          input: { databaseName: definition.databaseName(asset, target.database), sql },
          run: (signal) => definition.query(asset, target.database, sql, signal),
        });
      } catch (error) {
        void vscode.window.showErrorMessage(
          `Could not start ${definition.label} query: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      void updateContext(editor?.document);
    }),
  );
  void updateContext(vscode.window.activeTextEditor?.document);
  return async (asset, database, table) => {
    const document = await vscode.workspace.openTextDocument({
      language: 'sql',
      content: definition.initialQuery(database, table),
    });
    targets.set(document, { assetId: asset.id, database });
    await vscode.window.showTextDocument(document, { preview: false });
    await updateContext(vscode.window.activeTextEditor?.document);
  };
}
