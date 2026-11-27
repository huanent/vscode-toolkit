import * as vscode from 'vscode';
import { registerPostgresqlQueryEditor } from '@/features/database/postgresql/query-editor';
import type { PostgresqlService } from '@/features/database/postgresql/service';
import { PostgresqlTableService } from '@/features/database/postgresql/table-service';
import { qualifyPostgresqlIdentifier } from '@/features/database/postgresql/table-index';
import type { DatabaseDocument, PostgresqlConnectionConfiguration } from '@/features/database/protocol';
import { registerTableDataHandler } from '@/features/database/table-data-handler';
import { handleTableSchemaMessage } from '@/features/database/table-schema-handler';
import type { ResultTaskService } from '@/features/result/task-service';
import { showOperationError } from '@/host/utils/show-operation-error';
import { registerWebviewEditor } from '@/host/webview-editor';
import { formatTabTitle } from '@/shared/tab-title';

const databaseView = 'toolkit.postgresqlEditor';
const tableView = 'toolkit.postgresqlTableEditor';
const databaseScheme = 'toolkit-postgresql';
const tableScheme = 'toolkit-postgresql-table';

function parseUri(uri: vscode.Uri, scheme: string) {
  const params = new URLSearchParams(uri.query);
  const assetId = params.get('id');
  if (uri.scheme !== scheme || !assetId) throw new Error('Invalid PostgreSQL editor URI.');
  return { assetId, params };
}

function parseTableUri(uri: vscode.Uri) {
  const { assetId, params } = parseUri(uri, tableScheme);
  const database = params.get('database');
  const schema = params.get('schema');
  const name = params.get('name');
  if (!database || !schema || !name) throw new Error('Missing PostgreSQL table location.');
  return { assetId, database, schema, name };
}

export function registerPostgresqlEditor(context: vscode.ExtensionContext, service: PostgresqlService, tasks: ResultTaskService) {
  const openQuery = registerPostgresqlQueryEditor(context, service, tasks);
  const tables = new PostgresqlTableService(service);
  const selections = new Map<string, { database?: string; schema?: string; table?: string }>();

  async function load(asset: PostgresqlConnectionConfiguration, key: string, database?: string, schema?: string) {
    const data = await tables.readDatabase(asset, database, schema);
    const previous = selections.get(key);
    const table = previous?.database === data.currentDatabase && previous?.schema === data.currentSchema ? previous?.table : undefined;
    selections.set(key, { database: data.currentDatabase, schema: data.currentSchema, table: data.tables.some((entry) => entry.name === table) ? table : undefined });
    return data;
  }

  registerWebviewEditor<DatabaseDocument>(context, {
    viewType: databaseView,
    page: 'database/table',
    icon: 'database',
    validate: (uri) => { parseUri(uri, databaseScheme); },
    title: (uri) => {
      const { params } = parseUri(uri, databaseScheme);
      return formatTabTitle(params.get('name') ?? 'PostgreSQL Database', params.get('folder') ?? undefined);
    },
    load: async (uri) => {
      const { assetId } = parseUri(uri, databaseScheme);
      const key = uri.toString();
      const selection = selections.get(key);
      return load(await service.requireAsset(assetId), key, selection?.database, selection?.schema);
    },
    data: (uri) => {
      const { assetId, params } = parseUri(uri, databaseScheme);
      return { assetId, name: params.get('name') ?? 'PostgreSQL Database' };
    },
    onPanelResolved: (uri, panel) => {
      const key = uri.toString();
      const { assetId } = parseUri(uri, databaseScheme);
      const listener = panel.webview.onDidReceiveMessage(async (value: unknown) => {
        if (typeof value !== 'object' || value === null || !('type' in value) || value.type === 'ready') return;
        const message = value as Record<string, unknown>;
        const operation = message.type === 'createDatabase' || message.type === 'deleteDatabase';
        const requireSelection = () => {
          const selection = selections.get(key);
          if (!selection?.database || !selection.schema) throw new Error('Select a PostgreSQL database and schema first.');
          return { database: selection.database, schema: selection.schema };
        };
        const refresh = async (database?: string, schema?: string) => {
          const data = await load(await service.requireAsset(assetId), key, database, schema);
          await panel.webview.postMessage({ type: 'loaded', data });
        };
        try {
          if (await handleTableSchemaMessage(value, panel.webview, {
            createTable: async (options) => {
              const { database, schema } = requireSelection();
              await tables.createTable(await service.requireAsset(assetId), database, schema, options);
            },
            updateTableSchema: async (options) => {
              const { database, schema } = requireSelection();
              await tables.updateTableSchema(await service.requireAsset(assetId), database, schema, options);
              const selection = selections.get(key);
              if (selection?.table === options.tableName) selection.table = options.newTableName;
            },
            readDatabase: async () => {
              const { database, schema } = requireSelection();
              return load(await service.requireAsset(assetId), key, database, schema);
            },
            readIndexes: async (table) => {
              const { database, schema } = requireSelection();
              return tables.readIndexes(await service.requireAsset(assetId), database, schema, table);
            },
            changeIndex: async (table, change) => {
              const { database, schema } = requireSelection();
              await tables.changeIndex(await service.requireAsset(assetId), database, schema, table, change);
            },
          })) return;
          const selection = selections.get(key);
          switch (message.type) {
            case 'selectDatabase':
              if (typeof message.database === 'string') await refresh(message.database);
              break;
            case 'selectSchema':
              if (typeof message.schema === 'string') await refresh(selection?.database, message.schema);
              break;
            case 'createDatabase':
              if (typeof message.name !== 'string') throw new Error('Invalid database name.');
              await tables.createDatabase(await service.requireAsset(assetId), message.name, selection?.database);
              await refresh(message.name);
              break;
            case 'deleteDatabase':
              if (typeof message.database !== 'string') throw new Error('Invalid database name.');
              await tables.deleteDatabase(await service.requireAsset(assetId), message.database);
              await refresh(selection?.database === message.database ? 'postgres' : selection?.database,
                selection?.database === message.database ? undefined : selection?.schema);
              break;
            case 'openSqlEditor':
              await openQuery(await service.requireAsset(assetId), selection?.database,
                selection?.schema && selection.table ? qualifyPostgresqlIdentifier(selection.schema, selection.table) : undefined);
              break;
            case 'openTable':
            case 'deleteTable': {
              if (typeof message.tableName !== 'string') throw new Error('Invalid table name.');
              const { database, schema } = requireSelection();
              const name = message.tableName;
              if (message.type === 'openTable') {
                if (selection) selection.table = name;
                const query = new URLSearchParams({ id: assetId, database, schema, name });
                await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.from({ scheme: tableScheme, path: '/table', query: query.toString() }), tableView);
              } else {
                const answer = await vscode.window.showWarningMessage(`Delete table "${schema}.${name}"?`,
                  { modal: true, detail: 'This permanently deletes the table and all of its data.' }, 'Delete');
                if (answer !== 'Delete') return;
                await tables.deleteTable(await service.requireAsset(assetId), database, schema, name);
                await refresh(database, schema);
              }
              break;
            }
            default: return;
          }
          if (operation) await panel.webview.postMessage({ type: 'databaseOperationResult', success: true });
        } catch (error) {
          showOperationError(error);
          if (operation) await panel.webview.postMessage({ type: 'databaseOperationResult', success: false });
        }
      });
      return { dispose: () => { listener.dispose(); selections.delete(key); } };
    },
  });

  registerWebviewEditor(context, {
    viewType: tableView,
    page: 'database/data',
    icon: 'table',
    title: (uri) => { const { schema, name } = parseTableUri(uri); return `${schema}.${name}`; },
    validate: (uri) => { parseTableUri(uri); },
    load: async (uri) => {
      const { assetId, database, schema, name } = parseTableUri(uri);
      return tables.readTable(await service.requireAsset(assetId), database, schema, name);
    },
    data: (uri) => ({ name: parseTableUri(uri).name }),
    onPanelResolved: (uri, panel) => {
      const { assetId, database, schema, name } = parseTableUri(uri);
      return registerTableDataHandler(panel,
        async (filters, counts) => tables.readTable(await service.requireAsset(assetId), database, schema, name, filters, counts),
        async (mutation) => tables.mutateRow(await service.requireAsset(assetId), database, schema, name, mutation));
    },
  });

  return {
    openQuery,
    openDatabase: async (asset: PostgresqlConnectionConfiguration, folder?: string) => {
      const query = new URLSearchParams({ id: asset.id, name: asset.name });
      if (folder) query.set('folder', folder);
      await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.from({ scheme: databaseScheme, path: '/database', query: query.toString() }), databaseView);
    },
  };
}
