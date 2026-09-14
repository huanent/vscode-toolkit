import { cn } from 'cn';
import { IconButton } from '../../../../../components/ui/button';
import {
	ArrowDown,
	ArrowUp,
	ChevronsUpDown,
	Pencil,
	Trash2
} from '../../../../../components/ui/icons';
import { Input } from '../../../../../components/ui/input';
import type { MysqlTableFilter } from '../../types';
import { useMysqlTablePreview } from '.././hooks/useMysqlTablePreview';

export type PreviewState=ReturnType<typeof useMysqlTablePreview>;

export function Table({
	preview,
	filters,
	setFilters,
}: {
	preview: PreviewState;
	filters: Record<string, string>;
	setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
	const data=preview.data!;
	const columnWidths=data.columns.map((column, index) => {
		const type=data.columnInfo[index]?.dataType.toLowerCase()??'';
		const numeric=
			/^(tinyint|smallint|mediumint|int|bigint|decimal|numeric|float|double|bit|boolean)$/.test(
				type,
			);
		const temporal=/^(date|datetime|timestamp|time|year)$/.test(type);
		const minimum=numeric? 96:temporal? 168:144;
		const maximum=numeric? 176:temporal? 208:320;
		const contentLength=Math.max(
			column.length+4,
			...data.rows
				.slice(0, 30)
				.map(row =>
					Array.from(row.values[index]??'NULL').reduce(
						(width, character) => width+(character.charCodeAt(0)>255? 2:1),
						0,
					),
				),
		);
		return Math.min(maximum, Math.max(minimum, contentLength*7.5+24));
	});
	const toggleSort=(column: string) => {
		const sort=
			data.sort?.column!==column
				? { column, direction: 'asc' as const }
				:data.sort.direction==='asc'
					? { column, direction: 'desc' as const }
					:undefined;
		preview.loadPage(1, data.pageSize, sort, data.filters);
	};
	return (
		<table
			aria-label="Table data"
			style={{ width: columnWidths.reduce((total, width) => total+width, 72) }}
			className="min-w-full table-fixed border-separate border-spacing-0 whitespace-nowrap text-xs"
		>
			<colgroup>
				{data.columns.map((column, index) => (
					<col key={column} style={{ width: columnWidths[index] }} />
				))}
				<col style={{ width: 72 }} />
			</colgroup>
			<thead className="sticky top-0 z-10 bg-(--vscode-editor-background)">
				<tr>
					{data.columns.map(column => {
						const active=data.sort?.column===column;
						const SortIcon=!active
							? ChevronsUpDown
							:data.sort?.direction==='asc'
								? ArrowUp
								:ArrowDown;
						return (
							<th
								key={column}
								aria-sort={
									active? (data.sort?.direction==='asc'? 'ascending':'descending'):'none'
								}
								className="border-r border-b border-(--vscode-panel-border,var(--vscode-widget-border)) px-2 pb-2 text-left"
							>
								<button
									className="flex h-9 w-full items-center gap-2 border-0 bg-transparent px-1 text-left text-xs font-semibold hover:bg-(--vscode-list-hoverBackground)"
									onClick={() => toggleSort(column)}
								>
									<span className="truncate" title={column}>
										{column}
									</span>
									<SortIcon
										className="ml-auto shrink-0 text-(--vscode-descriptionForeground)"
										size="md"
									/>
								</button>
								<Input
									aria-label={`Filter ${column}`}
									size="sm"
									placeholder="Filter"
									value={filters[column]??''}
									onChange={event =>
										setFilters(current => ({ ...current, [column]: event.target.value }))
									}
									onKeyDown={event => {
										if(event.key==='Enter') {
											const next: MysqlTableFilter[]=Object.entries(filters)
												.filter(([, value]) => value)
												.map(([name, value]) => ({ column: name, value }));
											preview.loadPage(1, data.pageSize, data.sort, next);
										}
									}}
								/>
							</th>
						);
					})}
					<th
						aria-hidden="true"
						className="border-b border-(--vscode-panel-border,var(--vscode-widget-border))"
					/>
				</tr>
			</thead>
			<tbody>
				{data.rows.length===0&&(
					<tr>
						<td
							colSpan={data.columns.length+1}
							className="px-4 py-12 text-center text-(--vscode-descriptionForeground)"
						>
							No rows found.
						</td>
					</tr>
				)}
				{data.rows.map(row => (
					<tr key={row.rowId} className="group hover:bg-(--vscode-list-hoverBackground)">
						{row.values.map((value, index) => (
							<td
								key={data.columns[index]}
								className={cn(
									'max-w-80 overflow-hidden border-r border-b border-(--vscode-panel-border,var(--vscode-widget-border)) px-3 py-2 font-(family-name:--vscode-editor-font-family) text-ellipsis',
									value===null? 'italic text-(--vscode-descriptionForeground)':'',
								)}
								title={value??'NULL'}
							>
								{value??'NULL'}
							</td>
						))}
						<td
							style={{
								boxShadow: '-1px 0 0 var(--vscode-panel-border, var(--vscode-widget-border))',
							}}
							className="sticky right-0 z-1 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) bg-(--vscode-editor-background) px-1"
						>
							<span className="flex">
								<IconButton


									disabled={!data.canEdit}
									label={data.canEdit? 'Edit row':(data.editDisabledReason??'Row cannot be edited')}
									onClick={() => preview.openUpdate(row)}
									icon={<Pencil size="md" />} />
								<IconButton


									disabled={!data.canEdit}
									label={data.canEdit? 'Delete row':(data.editDisabledReason??'Row cannot be deleted')}
									onClick={() => preview.deleteRow(row.rowId)}
									icon={<Trash2 size="md" />} />
							</span>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
