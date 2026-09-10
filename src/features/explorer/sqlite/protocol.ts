export type DatabaseObject = {
	name: string;
	type: 'table' | 'view';
};

export type QueryResult = {
	columns: string[];
	values: unknown[][];
};

export type SqliteColumn = {
	name: string;
	type: string;
	notNull: boolean;
	primaryKey: boolean;
	defaultValue: string | null;
};

export type TableColumn = {
	name: string;
	type: string;
	primaryKey: boolean;
	notNull: boolean;
	defaultValue: string;
	originalName?: string;
};

export type NewRowValue = {
	columnName: string;
	value: unknown;
};

export type SqliteState = {
	objects: DatabaseObject[];
	selectedObject: DatabaseObject | null;
	columns: SqliteColumn[];
	result: QueryResult | null;
	rowIdVisible: boolean;
	totalRows: number;
	currentPage: number;
	status: string;
};

export type SqliteRequest =
	| { type: 'ready' }
	| { type: 'openObject'; object: DatabaseObject; page?: number }
	| { type: 'createTable'; requestId: string; tableName: string; columns: TableColumn[] }
	| {
			type: 'updateTable';
			requestId: string;
			originalName: string;
			tableName: string;
			columns: TableColumn[];
	  }
	| { type: 'updateRow'; requestId: string; rowIndex: number; values: unknown[] }
	| { type: 'createRow'; requestId: string; tableName: string; values: NewRowValue[] }
	| { type: 'deleteRow'; rowIndex: number }
	| { type: 'deleteTable'; object: DatabaseObject };

export type SqliteResponse =
	| { type: 'state'; state: SqliteState }
	| { type: 'operationResult'; requestId: string; error?: string }
	| { type: 'error'; message: string };
