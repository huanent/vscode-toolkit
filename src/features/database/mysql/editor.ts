import * as vscode from 'vscode';
import type { ResultTaskService } from '@/features/result/task-service';
import { registerWebviewEditor } from '@/host/webview-editor';
import type {
  CreateDatabaseMessage,
  CreateTableMessage,
  DatabaseDocument,
  DeleteDatabaseMessage,
  DeleteTableMessage,
  SelectDatabaseMessage,
  UpdateTableSchemaMessage,
} from '@/features/database/protocol';
import type { MysqlService } from '@/features/database/mysql-service';
import { registerMysqlQueryEditor } from './query-editor';

export const mysqlEditorViewType = 'toolkit.mysqlEditor';
export const mysqlTableEditorViewType = 'toolkit.mysqlTableEditor';
export const mysqlOpenTableCommand = 'toolkit.mysql.openTable';
export const mysqlOpenSqlEditorCommand = 'toolkit.mysql.openSqlEditor';

export const mysqlScheme = 'toolkit-mysql';
export const mysqlTableScheme = 'toolkit-mysql-table';

export function createMysqlUri(assetId: string, name?: string): vscode.Uri {
  const query = name ? `id=${encodeURIComponent(assetId)}&name=${encodeURIComponent(name)}` : `id=${encodeURIComponent(assetId)}`;
  return vscode.Uri.parse(`${mysqlScheme}:/database?${query}`);
}

export function parseMysqlUri(uri: vscode.Uri): { assetId: string } {
  if (uri.scheme !== mysqlScheme) throw new Error(`Invalid MySQL URI scheme: ${uri.scheme}`);
  const id = new URLSearchParams(uri.query).get('id');
  if (!id) throw new Error('Missing asset id in MySQL URI.');
  return { assetId: id };
}

export function validateMysqlUri(uri: vscode.Uri): void {
  parseMysqlUri(uri);
}

export function createMysqlTableUri(assetId: string, databaseName: string, tableName: string): vscode.Uri {
  return vscode.Uri.parse(
    `${mysqlTableScheme}:/table?id=${encodeURIComponent(assetId)}&database=${encodeURIComponent(databaseName)}&name=${encodeURIComponent(tableName)}`,
  );
}

export function parseMysqlTableUri(uri: vscode.Uri): { assetId: string; databaseName: string; tableName: string } {
  if (uri.scheme !== mysqlTableScheme) throw new Error(`Invalid MySQL table URI scheme: ${uri.scheme}`);
  const params = new URLSearchParams(uri.query);
  const assetId = params.get('id');
  const databaseName = params.get('database');
  const tableName = params.get('name');
  if (!assetId || !databaseName || !tableName) throw new Error('Missing parameters in MySQL table URI.');
  return { assetId, databaseName, tableName };
}

export function validateMysqlTableUri(uri: vscode.Uri): void {
  parseMysqlTableUri(uri);
}

export function registerMysqlEditor(
  context: vscode.ExtensionContext,
  mysqlService: MysqlService,
  tasks: ResultTaskService,
): vscode.Disposable {
  const openSqlQueryEditor = registerMysqlQueryEditor(context, mysqlService, tasks);
  const activeTableNames = new Map<string, string>();
  const activeDatabases = new Map<string, string>();

  const openTableCommand = vscode.commands.registerCommand(
    mysqlOpenTableCommand,
    async (assetId: string, databaseName: string, tableName: string) => {
      await vscode.commands.executeCommand(
        'vscode.openWith',
        createMysqlTableUri(assetId, databaseName, tableName),
        mysqlTableEditorViewType,
      );
    },
  );

  const openSqlEditorCommand = vscode.commands.registerCommand(mysqlOpenSqlEditorCommand, async () => {
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    if (
      typeof input !== 'object' ||
      input === null ||
      !('viewType' in input) ||
      input.viewType !== mysqlEditorViewType ||
      !('uri' in input)
    ) {
      return;
    }

    const uri = input.uri as vscode.Uri;
    const { assetId } = parseMysqlUri(uri);
    const asset = await mysqlService.requireAsset(assetId);
    const uriKey = uri.toString();
    await openSqlQueryEditor(asset, activeDatabases.get(uriKey), activeTableNames.get(uriKey));
  });

  context.subscriptions.push(openTableCommand, openSqlEditorCommand);

  const databaseEditor = registerWebviewEditor<DatabaseDocument>(context, {
    viewType: mysqlEditorViewType,
    page: 'database/table',
    icon: 'database',
    validate: validateMysqlUri,
    load: async (uri) => {
      const { assetId } = parseMysqlUri(uri);
      const uriKey = uri.toString();
      const targetDb = activeDatabases.get(uriKey);
      const doc = await mysqlService.readDatabaseDocument(assetId, targetDb);
      if (doc.currentDatabase) activeDatabases.set(uriKey, doc.currentDatabase);
      return doc;
    },
    data: (uri) => ({ name: new URLSearchParams(uri.query).get('name') ?? 'MySQL Database' }),
    onPanelResolved: (uri, panel) => {
      const uriKey = uri.toString();
      const { assetId } = parseMysqlUri(uri);

      const messageListener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (typeof message === 'object' && message !== null && 'type' in message && message.type === 'openSqlEditor') {
          const asset = await mysqlService.requireAsset(assetId);
          await openSqlQueryEditor(asset, activeDatabases.get(uriKey), activeTableNames.get(uriKey));
        } else if (isActiveTableChangedMessage(message)) {
          if (message.tableName) activeTableNames.set(uriKey, message.tableName);
          else activeTableNames.delete(uriKey);
        } else if (isOpenTableMessage(message)) {
          const currentDb = activeDatabases.get(uriKey);
          if (currentDb) {
            void vscode.commands.executeCommand(mysqlOpenTableCommand, assetId, currentDb, message.tableName);
          }
        } else if (isSelectDatabaseMessage(message)) {
          try {
            activeDatabases.set(uriKey, message.database);
            activeTableNames.delete(uriKey);
            const data = await mysqlService.readDatabaseDocument(assetId, message.database);
            await panel.webview.postMessage({ type: 'loaded', data });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(`Failed to switch database: ${errorMessage}`);
          }
        } else if (isCreateDatabaseMessage(message)) {
          try {
            await mysqlService.createDatabase(assetId, message.name);
            activeDatabases.set(uriKey, message.name);
            activeTableNames.delete(uriKey);
            const data = await mysqlService.readDatabaseDocument(assetId, message.name);
            await panel.webview.postMessage({ type: 'loaded', data });
            await panel.webview.postMessage({ type: 'databaseOperationResult', success: true });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(`Failed to create database: ${errorMessage}`);
            await panel.webview.postMessage({ type: 'databaseOperationResult', success: false, error: errorMessage });
          }
        } else if (isDeleteDatabaseMessage(message)) {
          try {
            await mysqlService.deleteDatabase(assetId, message.database);
            if (activeDatabases.get(uriKey) === message.database) {
              activeDatabases.delete(uriKey);
            }
            activeTableNames.delete(uriKey);
            const data = await mysqlService.readDatabaseDocument(assetId, activeDatabases.get(uriKey));
            if (data.currentDatabase) activeDatabases.set(uriKey, data.currentDatabase);
            await panel.webview.postMessage({ type: 'loaded', data });
            await panel.webview.postMessage({ type: 'databaseOperationResult', success: true });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(`Failed to delete database: ${errorMessage}`);
            await panel.webview.postMessage({ type: 'databaseOperationResult', success: false, error: errorMessage });
          }
        } else if (isDeleteTableMessage(message)) {
          const confirmation = await vscode.window.showWarningMessage(
            `Delete table "${message.tableName}"?`,
            { modal: true, detail: 'This permanently deletes the table and all of its data.' },
            'Delete',
          );
          if (confirmation !== 'Delete') return;

          try {
            const currentDb = activeDatabases.get(uriKey);
            if (!currentDb) throw new Error('No active database selected.');
            await mysqlService.deleteTable(assetId, currentDb, message.tableName);
            const data = await mysqlService.readDatabaseDocument(assetId, currentDb);
            await panel.webview.postMessage({ type: 'loaded', data });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            void vscode.window.showErrorMessage(`Failed to delete table: ${errorMessage}`);
          }
        } else if (isCreateTableMessage(message)) {
          try {
            const currentDb = activeDatabases.get(uriKey);
            if (!currentDb) throw new Error('No active database selected.');
            await mysqlService.createTable(assetId, currentDb, message);
            const data = await mysqlService.readDatabaseDocument(assetId, currentDb);
            await panel.webview.postMessage({ type: 'loaded', data });
            await panel.webview.postMessage({ type: 'schemaUpdateResult', success: true });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await panel.webview.postMessage({ type: 'schemaUpdateResult', success: false, error: errorMessage });
          }
        } else if (isUpdateTableSchemaMessage(message)) {
          try {
            const currentDb = activeDatabases.get(uriKey);
            if (!currentDb) throw new Error('No active database selected.');
            await mysqlService.updateTableSchema(assetId, currentDb, message);
            if (activeTableNames.get(uriKey) === message.tableName && message.tableName !== message.newTableName) {
              activeTableNames.set(uriKey, message.newTableName);
            }
            const data = await mysqlService.readDatabaseDocument(assetId, currentDb);
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
          activeDatabases.delete(uriKey);
        },
      };
    },
  });

  const tableEditor = registerWebviewEditor(context, {
    viewType: mysqlTableEditorViewType,
    page: 'database/data',
    icon: 'table',
    validate: validateMysqlTableUri,
    load: (uri) => {
      const { assetId, databaseName, tableName } = parseMysqlTableUri(uri);
      return mysqlService.readTable(assetId, databaseName, tableName);
    },
    data: (uri) => ({ name: new URLSearchParams(uri.query).get('name') ?? 'MySQL Table' }),
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

function isSelectDatabaseMessage(message: unknown): message is SelectDatabaseMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  const candidate = message as Partial<SelectDatabaseMessage>;
  return candidate.type === 'selectDatabase' && typeof candidate.database === 'string';
}

function isCreateDatabaseMessage(message: unknown): message is CreateDatabaseMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  const candidate = message as Partial<CreateDatabaseMessage>;
  return candidate.type === 'createDatabase' && typeof candidate.name === 'string';
}

function isDeleteDatabaseMessage(message: unknown): message is DeleteDatabaseMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  const candidate = message as Partial<DeleteDatabaseMessage>;
  return candidate.type === 'deleteDatabase' && typeof candidate.database === 'string';
}
