export type DatabaseCellValue = string | number | null;

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
