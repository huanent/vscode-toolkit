import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import type { DatabaseDocument } from './protocol';
import { registerSqliteQueryEditor } from './sqlite-query';
import {
  createSqliteTableUri,
  readSqliteDatabase,
  readSqliteTable,
  validateSqliteTableUri,
  validateSqliteUri,
} from './sqlite-service';

export const sqliteEditorViewType = 'toolkit.sqliteEditor';
export const sqliteTableEditorViewType = 'toolkit.sqliteTableEditor';
export const sqliteOpenSqlEditorCommand = 'toolkit.sqlite.openSqlEditor';
export const sqliteOpenTableCommand = 'toolkit.sqlite.openTable';

export function registerSqliteEditor(context: vscode.ExtensionContext): vscode.Disposable {
  const openSqlQueryEditor = registerSqliteQueryEditor(context);
  const activeTableNames = new Map<string, string>();
  const openTableCommand = vscode.commands.registerCommand(
    sqliteOpenTableCommand,
    async (databaseUri: vscode.Uri, tableName: string) => {
      await vscode.commands.executeCommand(
        'vscode.openWith',
        createSqliteTableUri(databaseUri, tableName),
        sqliteTableEditorViewType,
      );
    },
  );
  const openSqlEditorCommand = vscode.commands.registerCommand(sqliteOpenSqlEditorCommand, async () => {
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    if (
      typeof input !== 'object' ||
      input === null ||
      !('viewType' in input) ||
      input.viewType !== sqliteEditorViewType ||
      !('uri' in input)
    ) {
      return;
    }

    const databaseUri = input.uri as vscode.Uri;
    await openSqlQueryEditor(databaseUri, activeTableNames.get(databaseUri.toString()));
  });
  context.subscriptions.push(openTableCommand, openSqlEditorCommand);

  const databaseEditor = registerWebviewEditor<DatabaseDocument>(context, {
    viewType: sqliteEditorViewType,
    page: 'database',
    icon: 'database',
    validate: validateSqliteUri,
    load: readSqliteDatabase,
    onPanelResolved: (uri, panel) => {
      const uriKey = uri.toString();
      const messageListener = panel.webview.onDidReceiveMessage((message: unknown) => {
        if (isActiveTableChangedMessage(message)) {
          if (message.tableName) activeTableNames.set(uriKey, message.tableName);
          else activeTableNames.delete(uriKey);
        } else if (isOpenTableMessage(message)) {
          void vscode.commands.executeCommand(sqliteOpenTableCommand, uri, message.tableName);
        }
      });

      return {
        dispose: () => {
          messageListener.dispose();
          activeTableNames.delete(uriKey);
        },
      };
    },
  });

  const tableEditor = registerWebviewEditor(context, {
    viewType: sqliteTableEditorViewType,
    page: 'database-table',
    icon: 'table',
    validate: validateSqliteTableUri,
    load: readSqliteTable,
    data: (uri) => ({ name: new URLSearchParams(uri.query).get('name') ?? 'SQLite Table' }),
  });

  return {
    dispose: () => {
      databaseEditor.dispose();
      tableEditor.dispose();
    },
  };
}

function isOpenTableMessage(message: unknown): message is { type: 'openTable'; tableName: string } {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  return message.type === 'openTable' && 'tableName' in message && typeof message.tableName === 'string';
}

function isActiveTableChangedMessage(message: unknown): message is { type: 'activeTableChanged'; tableName?: string } {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  return (
    message.type === 'activeTableChanged' &&
    (!('tableName' in message) || message.tableName === undefined || typeof message.tableName === 'string')
  );
}
