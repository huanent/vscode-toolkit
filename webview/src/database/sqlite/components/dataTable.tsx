import type { QueryResult } from '../types';
import { IconButton } from '../../../components/ui/button';
import { Pencil, Trash2 } from '../../../components/ui/icons';

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
									<IconButton
										icon={<Pencil />}
										label="Edit row"
										size="sm"
										onClick={() => onEdit(rowIndex)}
									/>
									<IconButton
										icon={<Trash2 />}
										label="Delete row"
										size="sm"
										onClick={() => onDelete(rowIndex)}
									/>
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
