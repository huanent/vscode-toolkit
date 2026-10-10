export type DatabaseCellValue = string | number | null;

export interface MysqlConnectionConfiguration {
  id: string;
  type: 'mysql';
  parentId?: string;
  name: string;
  host: string;
  port: number;
  credentialId: string;
  database?: string;
  tls: boolean;
}

export interface DatabaseSchema {
  name: string;
  tables: string[];
}

export interface DatabaseColumn {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
}

export interface DatabaseTable {
  name: string;
  rowCount: number;
  columnCount: number;
  columns: DatabaseColumn[];
  rows: DatabaseCellValue[][];
  filteredRowCount?: number;
}

export interface DatabaseTableFilters {
  search?: string;
  columns?: Record<string, string>;
}

export interface DatabaseTableFilterRequest {
  type: 'filterTable';
  requestId: number;
  filters: DatabaseTableFilters;
}

export interface DatabaseTableFilterResult {
  type: 'tableFilterResult';
  requestId: number;
  data?: DatabaseTable;
  error?: string;
}

export function isDatabaseTableFilterRequest(value: unknown): value is DatabaseTableFilterRequest {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Partial<DatabaseTableFilterRequest>;
  if (message.type !== 'filterTable' || !Number.isSafeInteger(message.requestId)) return false;
  if (!message.filters || typeof message.filters !== 'object') return false;
  const { search, columns } = message.filters;
  return (
    (search === undefined || typeof search === 'string') &&
    (columns === undefined ||
      (typeof columns === 'object' &&
        columns !== null &&
        Object.values(columns).every((filter) => typeof filter === 'string')))
  );
}

export interface DatabaseDocument {
  engine: 'sqlite' | 'mysql';
  databases?: string[];
  currentDatabase?: string;
  tables: DatabaseTable[];
}

export interface DatabaseQueryInput {
  databaseName: string;
  sql: string;
}

export interface DatabaseQueryResult {
  hasResultSet: boolean;
  columns: string[];
  rows: DatabaseCellValue[][];
  rowCount: number;
  truncated: boolean;
  changes: number | string;
  lastInsertRowId?: number | string;
}

export interface SqliteTableColumnDefinition {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  originalName?: string;
}

export interface CreateSqliteTableOptions {
  tableName: string;
  columns: SqliteTableColumnDefinition[];
}

export interface CreateTableMessage extends CreateSqliteTableOptions {
  type: 'createTable';
}

export interface UpdateSqliteTableSchemaOptions {
  tableName: string;
  newTableName: string;
  columns: SqliteTableColumnDefinition[];
}

export interface UpdateTableSchemaMessage {
  type: 'updateTableSchema';
  tableName: string;
  newTableName: string;
  columns: SqliteTableColumnDefinition[];
}

export interface DeleteTableMessage {
  type: 'deleteTable';
  tableName: string;
}

export interface SelectDatabaseMessage {
  type: 'selectDatabase';
  database: string;
}

export interface CreateDatabaseMessage {
  type: 'createDatabase';
  name: string;
}

export interface DeleteDatabaseMessage {
  type: 'deleteDatabase';
  database: string;
}

export type DatabaseWebviewMessage =
  | { type: 'schemaUpdateResult'; success: true }
  | { type: 'schemaUpdateResult'; success: false; error: string }
  | { type: 'databaseOperationResult'; success: true }
  | { type: 'databaseOperationResult'; success: false; error: string };
