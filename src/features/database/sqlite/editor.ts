import * as vscode from 'vscode';
import { showOperationError } from '@/host/utils/show-operation-error';
import type { ResultTaskService } from '@/features/result/task-service';
import { registerWebviewEditor } from '@/host/webview-editor';
import type {
  CreateTableMessage,
  DatabaseDocument,
  DeleteTableMessage,
  DatabaseTableFilterResult,
  UpdateTableSchemaMessage,
} from '@/features/database/protocol';
import { isDatabaseTableFilterRequest } from '@/features/database/protocol';
import { registerTableDataHandler } from '@/features/database/table-data-handler';
import { registerSqliteQueryEditor } from './query-editor';
import {
  createSqliteTableUri,
  createSqliteTable,
  deleteSqliteTable,
  readSqliteDatabase,
  readSqliteTable,
  mutateSqliteTableRow,
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
      try {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          createSqliteTableUri(databaseUri, tableName),
          sqliteTableEditorViewType,
        );
      } catch (error) {
        showOperationError(error);
      }
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
    data: (uri) => ({ name: uri.path.split('/').pop() ?? 'SQLite Database', databaseUri: uri.toString() }),
    onPanelResolved: (uri, panel) => {
      const uriKey = uri.toString();
      const messageListener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (isDatabaseTableFilterRequest(message)) {
          const result: DatabaseTableFilterResult = { type: 'tableFilterResult', requestId: message.requestId };
          try {
            result.data = await readSqliteTable(uri, message.filters);
          } catch (error) {
            showOperationError(error);
          }
          await panel.webview.postMessage(result);
        } else if (
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'openSqlEditor'
        ) {
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
            showOperationError(`Failed to delete table: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else if (isCreateTableMessage(message)) {
          try {
            await createSqliteTable(uri, { tableName: message.tableName, columns: message.columns });
            const data = await readSqliteDatabase(uri);
            await panel.webview.postMessage({ type: 'loaded', data });
            await panel.webview.postMessage({ type: 'schemaUpdateResult', success: true });
          } catch (error) {
            showOperationError(error);
            await panel.webview.postMessage({ type: 'schemaUpdateResult', success: false });
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
            showOperationError(error);
            await panel.webview.postMessage({ type: 'schemaUpdateResult', success: false });
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
    title: (uri) => new URLSearchParams(uri.query).get('name') ?? 'SQLite Table',
    validate: validateSqliteTableUri,
    load: readSqliteTable,
    data: (uri) => ({ name: new URLSearchParams(uri.query).get('name') ?? 'SQLite Table' }),
    onPanelResolved: (uri, panel) =>
      registerTableDataHandler(
        panel,
        (filters, counts) => readSqliteTable(uri, filters, counts),
        (mutation) => mutateSqliteTableRow(uri, mutation),
      ),
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
