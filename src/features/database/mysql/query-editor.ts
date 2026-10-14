import * as vscode from 'vscode';
import { escapeId } from 'mysql2';
import type { MysqlConnectionConfiguration } from '@/features/database/protocol';
import type { ResultTaskService } from '@/features/result/task-service';
import type { MysqlService } from '@/features/database/mysql-service';

export const mysqlExecuteQueryCommand = 'toolkit.mysql.executeQuery';
export const mysqlQueryEditorContext = 'toolkit.mysqlQueryEditor';

interface MysqlDocumentTarget {
  asset: MysqlConnectionConfiguration;
  databaseName?: string;
}

export function registerMysqlQueryEditor(
  context: vscode.ExtensionContext,
  mysqlService: MysqlService,
  tasks: ResultTaskService,
): (asset: MysqlConnectionConfiguration, databaseName?: string, tableName?: string) => Promise<void> {
  const documentsByTarget = new WeakMap<vscode.TextDocument, MysqlDocumentTarget>();

  const updateContext = (document?: vscode.TextDocument) =>
    vscode.commands.executeCommand(
      'setContext',
      mysqlQueryEditorContext,
      Boolean(document && documentsByTarget.has(document)),
    );

  const command = vscode.commands.registerCommand(mysqlExecuteQueryCommand, async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const target = documentsByTarget.get(editor.document);
    if (!target) return;

    const query = (
      editor.selection.isEmpty ? editor.document.getText() : editor.document.getText(editor.selection)
    ).trim();
    if (!query) {
      void vscode.window.showWarningMessage('No SQL query to execute.');
      return;
    }

    try {
      await vscode.commands.executeCommand('toolkit.result.focus');
      await tasks.startTask({
        kind: 'mysql',
        title: `${target.asset.name}: ${query.replace(/\s+/g, ' ').slice(0, 64)}`,
        input: { databaseName: target.databaseName ?? target.asset.database ?? target.asset.name, sql: query },
        run: (signal) => mysqlService.query(target.asset, target.databaseName, query, signal),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Could not start MySQL query: ${message}`);
    }
  });

  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
    void updateContext(editor?.document);
  });
  context.subscriptions.push(command, activeEditorListener);
  void updateContext(vscode.window.activeTextEditor?.document);

  return async (asset, databaseName, tableName) => {
    const document = await vscode.workspace.openTextDocument({
      language: 'sql',
      content: createInitialQuery(databaseName, tableName),
    });
    documentsByTarget.set(document, { asset, databaseName });
    await vscode.window.showTextDocument(document, { preview: false });
    await updateContext(vscode.window.activeTextEditor?.document ?? document);
  };
}

function createInitialQuery(databaseName?: string, tableName?: string): string {
  const header = databaseName ? `-- Database: ${databaseName}\n` : '';
  if (!tableName) return header;
  return `${header}SELECT * FROM ${escapeId(tableName)} LIMIT 100;\n`;
}
