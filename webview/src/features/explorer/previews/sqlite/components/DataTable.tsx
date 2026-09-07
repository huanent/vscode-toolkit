import type { QueryResult } from '../types';

interface DataTableProps {
	result: QueryResult;
	editable: boolean;
	onEdit: (rowIndex: number) => void;
	onDelete: (rowIndex: number) => void;
}

export function DataTable({ result, editable, onEdit, onDelete }: DataTableProps) {
	if (!result.columns.length)
		return (
			<div className="p-3 text-xs text-(--vscode-descriptionForeground)">
				Statement completed without a result set.
			</div>
		);
	return (
		<table className="min-w-full border-separate border-spacing-0 text-xs">
			<thead className="sticky top-0 z-2">
				<tr>
					{result.columns.map((column, index) => (
						<th
							key={`${column}:${index}`}
							className="h-8 min-w-32 border-r border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background) px-2 text-left font-semibold"
						>
							{column}
						</th>
					))}
					{editable && (
						<th className="sticky right-0 z-3 h-8 w-16 min-w-16 border-b border-l border-(--vscode-panel-border) bg-(--vscode-sideBar-background) text-center font-semibold">
							Actions
						</th>
					)}
				</tr>
			</thead>
			<tbody>
				{result.values.map((row, rowIndex) => (
					<tr key={rowIndex} className="hover:bg-(--vscode-list-hoverBackground)">
						{result.columns.map((_, columnIndex) => (
							<td
								key={columnIndex}
								className="h-8 min-w-32 max-w-96 overflow-hidden border-r border-b border-(--vscode-panel-border) px-2 text-ellipsis whitespace-nowrap"
								title={formatValue(row[columnIndex])}
							>
								{formatValue(row[columnIndex])}
							</td>
						))}
						{editable && (
							<td className="sticky right-0 h-8 border-b border-l border-(--vscode-panel-border) bg-(--vscode-editor-background) px-1">
								<div className="flex justify-center gap-0.5">
									<button
										type="button"
										title="Edit row"
										className="grid size-6 place-items-center border-0 bg-transparent hover:bg-(--vscode-toolbar-hoverBackground)"
										onClick={() => onEdit(rowIndex)}
									>
										<i className="codicon codicon-edit" aria-hidden="true" />
									</button>
									<button
										type="button"
										title="Delete row"
										className="grid size-6 place-items-center border-0 bg-transparent text-(--vscode-errorForeground) hover:bg-(--vscode-toolbar-hoverBackground)"
										onClick={() => onDelete(rowIndex)}
									>
										<i className="codicon codicon-trash" aria-hidden="true" />
									</button>
								</div>
							</td>
						)}
					</tr>
				))}
			</tbody>
		</table>
	);
}

function formatValue(value: unknown): string {
	if (value === null) return 'NULL';
	if (value instanceof Uint8Array) return `<BLOB ${value.byteLength} bytes>`;
	return String(value ?? '');
}
