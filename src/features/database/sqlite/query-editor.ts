import * as vscode from 'vscode';
import { submitSqliteQuery } from './result-service';
import type { ResultTaskService } from '@/features/result/task-service';

export const sqliteExecuteQueryCommand = 'toolkit.sqlite.executeQuery';
export const sqliteQueryEditorContext = 'toolkit.sqliteQueryEditor';

export function registerSqliteQueryEditor(
  context: vscode.ExtensionContext,
  tasks: ResultTaskService,
): (databaseUri: vscode.Uri, tableName?: string) => Promise<void> {
  const databasesByDocument = new WeakMap<vscode.TextDocument, vscode.Uri>();
  const updateContext = (document?: vscode.TextDocument) =>
    vscode.commands.executeCommand(
      'setContext',
      sqliteQueryEditorContext,
      Boolean(document && databasesByDocument.has(document)),
    );

  const command = vscode.commands.registerCommand(sqliteExecuteQueryCommand, async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const databaseUri = databasesByDocument.get(editor.document);
    if (!databaseUri) return;

    const query = (
      editor.selection.isEmpty ? editor.document.getText() : editor.document.getText(editor.selection)
    ).trim();
    if (!query) {
      void vscode.window.showWarningMessage('No SQL query to execute.');
      return;
    }

    try {
      await submitSqliteQuery(tasks, databaseUri, query);
    } catch (error) {
      void vscode.window.showErrorMessage(`Could not start SQLite query: ${getErrorMessage(error)}`);
    }
  });
  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
    void updateContext(editor?.document);
  });
  context.subscriptions.push(command, activeEditorListener);
  void updateContext(vscode.window.activeTextEditor?.document);

  return async (databaseUri, tableName) => {
    const document = await vscode.workspace.openTextDocument({
      language: 'sql',
      content: createInitialQuery(tableName),
    });
    databasesByDocument.set(document, databaseUri);
    await vscode.window.showTextDocument(document, { preview: false });
    await updateContext(vscode.window.activeTextEditor?.document ?? document);
  };
}

function createInitialQuery(tableName?: string): string {
  if (!tableName) return '';
  return `SELECT * FROM "${tableName.replaceAll('"', '""')}" LIMIT 100;\n`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
