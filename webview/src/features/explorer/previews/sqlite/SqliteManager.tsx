import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { CreateTableDialog, type TableColumn } from './CreateTableDialog';
import { EditRowDialog } from './EditRowDialog';
import { NewRowDialog, type NewRowValue } from './NewRowDialog';
import { DataTable } from './components/DataTable';
import { DatabaseSidebar } from './components/DatabaseSidebar';
import { PaginationFooter } from './components/PaginationFooter';
import { TableContextMenu } from './components/TableContextMenu';
import type { DatabaseObject, SqliteRequest, SqliteResponse, SqliteState } from './types';

const vscode = acquireVsCodeApi();
const pageSize = 100;

type TableContextMenuState = {
	object: DatabaseObject;
	x: number;
	y: number;
};

type OperationResolver = (error?: string) => void;

const initialState: SqliteState = {
	objects: [],
	selectedObject: null,
	columns: [],
	result: null,
	rowIdVisible: false,
	totalRows: 0,
	currentPage: 1,
	status: 'Opening database...',
};

export function SqliteManager({ name }: { name: string }) {
	const [state, setState] = useState(initialState);
	const [createTableOpen, setCreateTableOpen] = useState(false);
	const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
	const [newRowTable, setNewRowTable] = useState<DatabaseObject | null>(null);
	const [editingTable, setEditingTable] = useState<DatabaseObject | null>(null);
	const [tableContextMenu, setTableContextMenu] = useState<TableContextMenuState | null>(null);
	const operationResolvers = useRef(new Map<string, OperationResolver>());

	function postMessage(message: SqliteRequest) {
		vscode.postMessage(message);
	}

	function openObject(object: DatabaseObject, page = 1) {
		postMessage({ type: 'openObject', object, page });
	}

	function runOperation(
		createRequest: (requestId: string) => SqliteRequest,
	): Promise<string | undefined> {
		return new Promise(resolve => {
			const requestId = crypto.randomUUID();
			operationResolvers.current.set(requestId, resolve);
			postMessage(createRequest(requestId));
		});
	}

	async function createTable(
		tableName: string,
		columns: TableColumn[],
	): Promise<string | undefined> {
		const error = await runOperation(requestId => ({
			type: 'createTable',
			requestId,
			tableName,
			columns,
		}));
		if (!error) setCreateTableOpen(false);
		return error;
	}

	async function updateTable(
		tableName: string,
		columns: TableColumn[],
	): Promise<string | undefined> {
		if (!editingTable) return 'No table is selected.';
		const error = await runOperation(requestId => ({
			type: 'updateTable',
			requestId,
			originalName: editingTable.name,
			tableName,
			columns,
		}));
		if (!error) setEditingTable(null);
		return error;
	}

	async function updateRow(values: unknown[]): Promise<string | undefined> {
		if (editingRowIndex === null) return 'No row is selected.';
		const error = await runOperation(requestId => ({
			type: 'updateRow',
			requestId,
			rowIndex: editingRowIndex,
			values,
		}));
		if (!error) setEditingRowIndex(null);
		return error;
	}

	async function createRow(values: NewRowValue[]): Promise<string | undefined> {
		if (!newRowTable) return 'No table is selected.';
		const error = await runOperation(requestId => ({
			type: 'createRow',
			requestId,
			tableName: newRowTable.name,
			values: values.map(item => ({ columnName: item.column.name, value: item.value })),
		}));
		if (!error) setNewRowTable(null);
		return error;
	}

	const onMessage = useEffectEvent(({ data: message }: MessageEvent<SqliteResponse>) => {
		if (message.type === 'state') {
			setState(message.state);
		} else if (message.type === 'operationResult') {
			const resolve = operationResolvers.current.get(message.requestId);
			if (!resolve) return;
			operationResolvers.current.delete(message.requestId);
			resolve(message.error);
		} else if (message.type === 'error') {
			setState(current => ({ ...current, status: message.message }));
		}
	});

	useEffect(() => {
		window.addEventListener('message', onMessage);
		postMessage({ type: 'ready' });
		return () => {
			window.removeEventListener('message', onMessage);
			operationResolvers.current.forEach(resolve => resolve('Database panel closed.'));
			operationResolvers.current.clear();
		};
	}, []);

	const { objects, selectedObject, columns, result, rowIdVisible, totalRows, currentPage } = state;

	return (
		<main className="grid h-full min-w-0 grid-cols-[220px_minmax(0,1fr)] grid-rows-[44px_minmax(0,1fr)] overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
			<header className="col-span-2 flex items-center gap-2 border-b border-(--vscode-panel-border) px-3">
				<i className="codicon codicon-database text-base" aria-hidden="true" />
				<h1 className="m-0 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">
					{name}
				</h1>
				<span className="text-xs text-(--vscode-descriptionForeground)">{state.status}</span>
			</header>
			<DatabaseSidebar
				objects={objects}
				selectedObject={selectedObject}
				onCreateTable={() => setCreateTableOpen(true)}
				onOpenObject={openObject}
				onOpenContextMenu={(object, event) => {
					event.preventDefault();
					openObject(object);
					setTableContextMenu({ object, x: event.clientX, y: event.clientY });
				}}
			/>
			<section className="flex min-h-0 min-w-0 flex-col">
				<div className="min-h-0 flex-1 overflow-auto">
					{result ? (
						<DataTable
							result={result}
							editable={selectedObject?.type === 'table' && !isSystemTable(selectedObject)}
							onEdit={setEditingRowIndex}
							onDelete={rowIndex => postMessage({ type: 'deleteRow', rowIndex })}
						/>
					) : (
						<div className="grid h-full place-items-center text-sm text-(--vscode-descriptionForeground)">
							Select a table to view its data.
						</div>
					)}
				</div>
				{result && (
					<PaginationFooter
						totalRows={totalRows}
						currentPage={currentPage}
						pageSize={pageSize}
						onPrevious={() => selectedObject && openObject(selectedObject, currentPage - 1)}
						onNext={() => selectedObject && openObject(selectedObject, currentPage + 1)}
					/>
				)}
			</section>
			{createTableOpen && (
				<CreateTableDialog onCancel={() => setCreateTableOpen(false)} onCreate={createTable} />
			)}
			{editingRowIndex !== null && result && (
				<EditRowDialog
					columns={columns}
					row={
						rowIdVisible ? result.values[editingRowIndex].slice(1) : result.values[editingRowIndex]
					}
					onCancel={() => setEditingRowIndex(null)}
					onSave={updateRow}
				/>
			)}
			{newRowTable && (
				<NewRowDialog
					tableName={newRowTable.name}
					columns={columns}
					onCancel={() => setNewRowTable(null)}
					onCreate={createRow}
				/>
			)}
			{editingTable && (
				<CreateTableDialog
					title="Edit table"
					submitLabel="Apply"
					initialTableName={editingTable.name}
					initialColumns={columns.map(column => ({
						name: column.name,
						originalName: column.name,
						type: column.type || 'TEXT',
						primaryKey: column.primaryKey,
						notNull: column.notNull,
						defaultValue: column.defaultValue ?? '',
					}))}
					onCancel={() => setEditingTable(null)}
					onCreate={updateTable}
				/>
			)}
			{tableContextMenu && (
				<TableContextMenu
					{...tableContextMenu}
					onClose={() => setTableContextMenu(null)}
					onNewRow={setNewRowTable}
					onEditTable={setEditingTable}
					onDeleteTable={object => postMessage({ type: 'deleteTable', object })}
				/>
			)}
		</main>
	);
}

function isSystemTable(object: DatabaseObject): boolean {
	return object.name.startsWith('sqlite_');
}
