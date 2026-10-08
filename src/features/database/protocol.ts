export type DatabaseCellValue = string | number | null;

export interface MysqlConnectionConfiguration {
  id: string;
  type: 'mysql';
  name: string;
  host: string;
  port: number;
  user: string;
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
}

export interface DatabaseDocument {
  engine: 'sqlite';
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

export type DatabaseWebviewMessage =
  | { type: 'schemaUpdateResult'; success: true }
  | { type: 'schemaUpdateResult'; success: false; error: string };
