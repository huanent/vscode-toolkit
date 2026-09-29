import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import type { DatabaseDocument } from './protocol';
import { registerSqliteQueryEditor } from './sqlite-query';
import { readSqliteDatabase, validateSqliteUri } from './sqlite-service';

export const sqliteEditorViewType = 'toolkit.sqliteEditor';

export function registerSqliteEditor(context: vscode.ExtensionContext): vscode.Disposable {
  const openSqlQueryEditor = registerSqliteQueryEditor(context);
  return registerWebviewEditor<DatabaseDocument>(context, {
    viewType: sqliteEditorViewType,
    page: 'database',
    icon: 'database',
    validate: validateSqliteUri,
    load: readSqliteDatabase,
    onPanelResolved: (uri, panel) =>
      panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (!isOpenSqlEditorMessage(message)) return;

        await openSqlQueryEditor(uri, message.tableName);
      }),
  });
}

function isOpenSqlEditorMessage(message: unknown): message is { type: 'openSqlEditor'; tableName?: string } {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  return message.type === 'openSqlEditor' && (!('tableName' in message) || typeof message.tableName === 'string');
}
