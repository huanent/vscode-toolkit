export type DatabaseCellValue = string | number | null;

export interface DatabaseConnectionConfiguration<TType extends string = string> {
  id: string;
  type: TType;
  name: string;
  host: string;
  port: number;
  credentialId: string;
  proxyAssetIds?: string[];
  database?: string;
  tls: boolean;
}

export type PostgresqlConnectionConfiguration = DatabaseConnectionConfiguration<'postgresql'>;

export type MysqlConnectionConfiguration = DatabaseConnectionConfiguration<'mysql'>;

export interface DatabaseSchema {
  name: string;
  tables: string[];
}

export interface DatabaseColumn {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  readOnly?: boolean;
}

export interface DatabaseTable {
  name: string;
  rowCount: number;
  columnCount: number;
  columns: DatabaseColumn[];
  rows: DatabaseCellValue[][];
  filteredRowCount?: number;
  rowCountKnown?: boolean;
  rowCountCapped?: boolean;
}

export const databaseTablePageSize = 100;
export const sqliteOverviewRowCountLimit = 1000;

export type DatabaseTableCounts = Pick<DatabaseTable, 'rowCount' | 'filteredRowCount'>;

export interface DatabaseTableFilters {
  search?: string;
  columns?: Record<string, string>;
  page?: number;
  revision?: number;
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

export interface DatabaseRowMutation {
  operation: 'create' | 'update' | 'delete';
  values: Record<string, DatabaseCellValue>;
  original?: Record<string, DatabaseCellValue>;
}

export interface DatabaseRowMutationRequest extends DatabaseRowMutation {
  type: 'mutateRow';
  requestId: number;
}

export interface DatabaseRowMutationResult {
  type: 'rowMutationResult';
  requestId: number;
  error?: string;
  cancelled?: boolean;
}

export function isDatabaseRowMutationRequest(value: unknown): value is DatabaseRowMutationRequest {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Partial<DatabaseRowMutationRequest>;
  const isRecord = (record: unknown): record is Record<string, DatabaseCellValue> =>
    typeof record === 'object' &&
    record !== null &&
    !Array.isArray(record) &&
    Object.values(record).every(
      (cell) => cell === null || typeof cell === 'string' || (typeof cell === 'number' && Number.isFinite(cell)),
    );
  return (
    message.type === 'mutateRow' &&
    Number.isSafeInteger(message.requestId) &&
    ['create', 'update', 'delete'].includes(message.operation ?? '') &&
    isRecord(message.values) &&
    (message.operation === 'create' || isRecord(message.original))
  );
}

export function isDatabaseTableFilterRequest(value: unknown): value is DatabaseTableFilterRequest {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Partial<DatabaseTableFilterRequest>;
  if (message.type !== 'filterTable' || !Number.isSafeInteger(message.requestId)) return false;
  if (!message.filters || typeof message.filters !== 'object') return false;
  const { search, columns, page, revision } = message.filters;
  return (
    (search === undefined || typeof search === 'string') &&
    (columns === undefined ||
      (typeof columns === 'object' &&
        columns !== null &&
        Object.values(columns).every((filter) => typeof filter === 'string'))) &&
    (page === undefined || (Number.isSafeInteger(page) && page >= 0)) &&
    (revision === undefined || (Number.isSafeInteger(revision) && revision >= 0))
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
