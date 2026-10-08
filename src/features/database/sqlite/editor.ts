import * as vscode from 'vscode';
import type { ResultTaskService } from '@/features/result/task-service';
import { registerWebviewEditor } from '@/host/webview-editor';
import type {
  CreateTableMessage,
  DatabaseDocument,
  DeleteTableMessage,
  UpdateTableSchemaMessage,
} from '@/features/database/protocol';
import { registerSqliteQueryEditor } from './query-editor';
import {
  createSqliteTableUri,
  createSqliteTable,
  deleteSqliteTable,
  readSqliteDatabase,
  readSqliteTable,
  updateSqliteTableSchema,
  validateSqliteTableUri,
  validateSqliteUri,
} from './service';

export const sqliteEditorViewType = 'toolkit.sqliteEditor';
export const sqliteTableEditorViewType = 'toolkit.sqliteTableEditor';
export const sqliteOpenSqlEditorCommand = 'toolkit.sqlite.openSqlEditor';
export const sqliteOpenTableCommand = 'toolkit.sqlite.openTable';

export function registerSqliteEditor(context: vscode.ExtensionContext, tasks: ResultTaskService): vscode.Disposable {
  const openSqlQueryEditor = registerSqliteQueryEditor(context, tasks);
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
    page: 'database/table',
    icon: 'database',
    validate: validateSqliteUri,
    load: readSqliteDatabase,
    onPanelResolved: (uri, panel) => {
      const uriKey = uri.toString();
      const messageListener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'openSqlEditor') {
          await openSqlQueryEditor(uri, activeTableNames.get(uriKey));
        } else if (isActiveTableChangedMessage(message)) {
          if (message.tableName) activeTableNames.set(uriKey, message.tableName);
          else activeTableNames.delete(uriKey);
        } else if (isOpenTableMessage(message)) {
          void vscode.commands.executeCommand(sqliteOpenTableCommand, uri, message.tableName);
        } else if (isDeleteTableMessage(message)) {
          const confirmation = await vscode.window.showWarningMessage(
            `Delete table "${message.tableName}"?`,
            { modal: true, detail: 'This permanently deletes the table and all of its data.' },
            'Delete',
          );
          if (confirmation !== 'Delete') return;

          try {
            await deleteSqliteTable(uri, message.tableName);
            const data = await readSqliteDatabase(uri);
            await panel.webview.postMessage({ type: 'loaded', data });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(`Failed to delete table: ${errorMessage}`);
          }
        } else if (isCreateTableMessage(message)) {
          try {
            await createSqliteTable(uri, { tableName: message.tableName, columns: message.columns });
            const data = await readSqliteDatabase(uri);
            await panel.webview.postMessage({ type: 'loaded', data });
            await panel.webview.postMessage({ type: 'schemaUpdateResult', success: true });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await panel.webview.postMessage({ type: 'schemaUpdateResult', success: false, error: errorMessage });
          }
        } else if (isUpdateTableSchemaMessage(message)) {
          try {
            await updateSqliteTableSchema(uri, {
              tableName: message.tableName,
              newTableName: message.newTableName,
              columns: message.columns,
            });
            if (activeTableNames.get(uriKey) === message.tableName && message.tableName !== message.newTableName) {
              activeTableNames.set(uriKey, message.newTableName);
            }
            const data = await readSqliteDatabase(uri);
            await panel.webview.postMessage({ type: 'loaded', data });
            await panel.webview.postMessage({ type: 'schemaUpdateResult', success: true });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(`Failed to update schema: ${errorMessage}`);
            await panel.webview.postMessage({ type: 'schemaUpdateResult', success: false, error: errorMessage });
          }
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
    page: 'database/data',
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

function isDeleteTableMessage(message: unknown): message is DeleteTableMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  const candidate = message as Partial<DeleteTableMessage>;
  return candidate.type === 'deleteTable' && typeof candidate.tableName === 'string';
}

function isActiveTableChangedMessage(message: unknown): message is { type: 'activeTableChanged'; tableName?: string } {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  return (
    message.type === 'activeTableChanged' &&
    (!('tableName' in message) || message.tableName === undefined || typeof message.tableName === 'string')
  );
}

function isCreateTableMessage(message: unknown): message is CreateTableMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  const candidate = message as Partial<CreateTableMessage>;
  return (
    candidate.type === 'createTable' && typeof candidate.tableName === 'string' && Array.isArray(candidate.columns)
  );
}

function isUpdateTableSchemaMessage(message: unknown): message is UpdateTableSchemaMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  const candidate = message as Partial<UpdateTableSchemaMessage>;
  return (
    candidate.type === 'updateTableSchema' &&
    typeof candidate.tableName === 'string' &&
    typeof candidate.newTableName === 'string' &&
    Array.isArray(candidate.columns)
  );
}
