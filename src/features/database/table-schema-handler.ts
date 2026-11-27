import { window, type Webview } from 'vscode';
import type {
  CreateTableOptions,
  DatabaseDocument,
  DatabaseTableColumnDefinition,
  TableIndex,
  TableIndexChange,
  UpdateTableSchemaOptions,
} from '@/features/database/protocol';
import { showOperationError } from '@/host/utils/show-operation-error';
import { isTableIndexChange } from '@/features/database/table-index';

export interface TableSchemaOperations {
  createTable(options: CreateTableOptions): Promise<void>;
  updateTableSchema(options: UpdateTableSchemaOptions): Promise<void>;
  readDatabase(): Promise<DatabaseDocument>;
  readIndexes(table: string): Promise<TableIndex[]>;
  changeIndex(table: string, change: TableIndexChange): Promise<void>;
}

export async function handleTableSchemaMessage(
  message: unknown,
  webview: Webview,
  operations: TableSchemaOperations,
): Promise<boolean> {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;
  if (message.type === 'readTableIndexes' || message.type === 'changeTableIndex') {
    if (!('requestId' in message) || typeof message.requestId !== 'string') {
      showOperationError('Invalid index request ID.');
      return true;
    }
    const result: { type: string; requestId: string; indexes?: TableIndex[] } = {
      type: 'tableIndexesResult', requestId: message.requestId,
    };
    try {
      if (!('tableName' in message) || typeof message.tableName !== 'string' || !message.tableName.trim() || message.tableName.includes('\0')) {
        throw new Error('Invalid table name.');
      }
      if (message.type === 'changeTableIndex') {
        if (!('change' in message) || !isTableIndexChange(message.change)) throw new Error('Invalid index definition.');
        const change = message.change;
        if (change.operation !== 'delete' || await window.showWarningMessage(
          `Delete index "${change.original.name}"?`, { modal: true }, 'Delete',
        ) === 'Delete') await operations.changeIndex(message.tableName, change);
      }
      result.indexes = await operations.readIndexes(message.tableName);
    } catch (error) {
      showOperationError(error);
    }
    await webview.postMessage(result);
    return true;
  }
  if (message.type !== 'createTable' && message.type !== 'updateTableSchema') return false;

  try {
    if (
      !('tableName' in message) ||
      typeof message.tableName !== 'string' ||
      !message.tableName.trim() ||
      !('columns' in message) ||
      !Array.isArray(message.columns) ||
      !message.columns.length ||
      !message.columns.every(isColumnDefinition)
    ) {
      throw new Error('Invalid table definition.');
    }

    function isColumnDefinition(value: unknown): value is DatabaseTableColumnDefinition {
      return (
        typeof value === 'object' && value !== null &&
        'name' in value && typeof value.name === 'string' && !!value.name.trim() &&
        'type' in value && typeof value.type === 'string' && !!value.type.trim() &&
        'primaryKey' in value && typeof value.primaryKey === 'boolean' &&
        'notNull' in value && typeof value.notNull === 'boolean' &&
        (!('originalName' in value) || value.originalName === undefined || typeof value.originalName === 'string')
      );
    }
    const options = { tableName: message.tableName, columns: message.columns };
    if (message.type === 'createTable') {
      await operations.createTable(options);
    } else {
      if (!('newTableName' in message) || typeof message.newTableName !== 'string' || !message.newTableName.trim()) {
        throw new Error('Invalid new table name.');
      }
      const originalColumns: unknown = 'originalColumns' in message ? message.originalColumns : undefined;
      if (!Array.isArray(originalColumns) || !originalColumns.every((column) => typeof column === 'string')) {
        throw new Error('Invalid original column list.');
      }
      await operations.updateTableSchema({ ...options, newTableName: message.newTableName, originalColumns });
    }
    await webview.postMessage({ type: 'loaded', data: await operations.readDatabase() });
    await webview.postMessage({ type: 'schemaUpdateResult', success: true });
  } catch (error) {
    showOperationError(error);
    await webview.postMessage({ type: 'schemaUpdateResult', success: false });
  }
  return true;
}
