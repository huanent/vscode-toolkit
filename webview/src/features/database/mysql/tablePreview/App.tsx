import { cn } from 'cn';
import {
	ArrowDown,
	ArrowUp,
	ChevronLeft,
	ChevronRight,
	ChevronsUpDown,
	LoaderCircle,
	Pencil,
	Plus,
	RefreshCw,
	Trash2,
} from '../../../../components/icons';
import { useEffect, useRef, useState } from 'react';
import { IconButton, PrimaryButton } from '../../../../components/button';
import { Dialog } from '../../../../components/dialog';
import { SelectInput, TextArea, TextInput } from '../../../../components/input';
import { SqlPreview } from '../../components/SqlPreview';
import type { MysqlColumnInfo, MysqlTableFilter } from '../types';
import { useMysqlTablePreview } from './useMysqlTablePreview';

const pageSizes = [50, 100, 300, 500, 1000];

export function App() {
	const preview = useMysqlTablePreview();
	const [filters, setFilters] = useState<Record<string, string>>({});
	const filtersInitialized = useRef(false);
	useEffect(() => {
		if (!preview.data || filtersInitialized.current) return;
		filtersInitialized.current = true;
		setFilters(
			Object.fromEntries(preview.data.filters.map(filter => [filter.column, filter.value])),
		);
	}, [preview.data?.filters]);
	useEffect(() => {
		if (!preview.data) return;
		const timer = window.setTimeout(() => {
			const next = Object.entries(filters)
				.filter(([, value]) => value !== '')
				.map(([column, value]) => ({ column, value }));
			if (JSON.stringify(next) !== JSON.stringify(preview.data!.filters))
				preview.loadPage(1, preview.data!.pageSize, preview.data!.sort, next);
		}, 350);
		return () => window.clearTimeout(timer);
	}, [filters]);

	if (!preview.identity)
		return (
			<div className="grid h-screen place-items-center">
				<LoaderCircle className="animate-spin" />
			</div>
		);
	const data = preview.data;
	return (
		<div className="grid h-screen min-w-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden pt-11">
			<header className="fixed inset-x-0 top-0 z-20 flex h-11 min-w-0 items-center border-b border-(--vscode-panel-border,var(--vscode-widget-border)) bg-(--vscode-editor-background) px-1">
				<span className="flex min-w-0 w-full items-center gap-1 whitespace-nowrap text-xs">
					<span>{data ? new Intl.NumberFormat().format(data.totalRows) : ''} Rows</span>
					<span className="w-18 shrink-0">
						<SelectInput
							aria-label="Rows per page"
							disabled={!data || preview.loading}
							className="h-7 w-18"
							value={data?.pageSize ?? 100}
							onChange={event =>
								data && preview.loadPage(1, Number(event.target.value), data.sort, data.filters)
							}
						>
							{pageSizes.map(size => (
								<option key={size}>{size}</option>
							))}
						</SelectInput>
					</span>
					<span
						className="min-w-0 truncate px-1 tabular-nums"
						title={`${data?.page ?? 1} / ${data?.totalPages ?? 1}`}
					>
						{data?.page ?? 1} / {data?.totalPages ?? 1}
					</span>
					<IconButton
						className="size-7 border-0"
						disabled={!data || preview.loading || data.page <= 1}
						title="Previous page"
						onClick={() => data && preview.loadPage(data.page - 1)}
					>
						<ChevronLeft size={16} />
					</IconButton>
					<IconButton
						className="size-7 border-0"
						disabled={!data || preview.loading || data.page >= data.totalPages}
						title="Next page"
						onClick={() => data && preview.loadPage(data.page + 1)}
					>
						<ChevronRight size={16} />
					</IconButton>
					<IconButton
						className="ml-auto size-7 border-0"
						title="Insert row"
						disabled={!data || preview.loading}
						onClick={preview.openInsert}
					>
						<Plus size={16} />
					</IconButton>
					<IconButton
						className="size-7 border-0"
						title="Refresh"
						disabled={preview.loading}
						onClick={preview.refresh}
					>
						<RefreshCw size={16} className={cn(preview.loading ? 'animate-spin' : '')} />
					</IconButton>
				</span>
			</header>
			<main aria-busy={preview.loading} className="min-h-0 overflow-auto">
				{preview.loading && !data ? (
					<Status loading>Loading table...</Status>
				) : preview.error && !data ? (
					<Status error>{preview.error}</Status>
				) : data ? (
					<Table preview={preview} filters={filters} setFilters={setFilters} />
				) : null}
			</main>
			{preview.dialog && data && <RowDialog preview={preview} />}
		</div>
	);
}

type PreviewState = ReturnType<typeof useMysqlTablePreview>;
function Table({
	preview,
	filters,
	setFilters,
}: {
	preview: PreviewState;
	filters: Record<string, string>;
	setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
	const data = preview.data!;
	const columnWidths = data.columns.map((column, index) => {
		const type = data.columnInfo[index]?.dataType.toLowerCase() ?? '';
		const numeric =
			/^(tinyint|smallint|mediumint|int|bigint|decimal|numeric|float|double|bit|boolean)$/.test(
				type,
			);
		const temporal = /^(date|datetime|timestamp|time|year)$/.test(type);
		const minimum = numeric ? 96 : temporal ? 168 : 144;
		const maximum = numeric ? 176 : temporal ? 208 : 320;
		const contentLength = Math.max(
			column.length + 4,
			...data.rows
				.slice(0, 30)
				.map(row =>
					Array.from(row.values[index] ?? 'NULL').reduce(
						(width, character) => width + (character.charCodeAt(0) > 255 ? 2 : 1),
						0,
					),
				),
		);
		return Math.min(maximum, Math.max(minimum, contentLength * 7.5 + 24));
	});
	const toggleSort = (column: string) => {
		const sort =
			data.sort?.column !== column
				? { column, direction: 'asc' as const }
				: data.sort.direction === 'asc'
					? { column, direction: 'desc' as const }
					: undefined;
		preview.loadPage(1, data.pageSize, sort, data.filters);
	};
	return (
		<table
			aria-label="Table data"
			style={{ width: columnWidths.reduce((total, width) => total + width, 72) }}
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
						const active = data.sort?.column === column;
						const SortIcon = !active
							? ChevronsUpDown
							: data.sort?.direction === 'asc'
								? ArrowUp
								: ArrowDown;
						return (
							<th
								key={column}
								aria-sort={
									active ? (data.sort?.direction === 'asc' ? 'ascending' : 'descending') : 'none'
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
										size={13}
									/>
								</button>
								<TextInput
									aria-label={`Filter ${column}`}
									className="h-7 rounded-xs text-xs font-normal"
									placeholder="Filter"
									value={filters[column] ?? ''}
									onChange={event =>
										setFilters(current => ({ ...current, [column]: event.target.value }))
									}
									onKeyDown={event => {
										if (event.key === 'Enter') {
											const next: MysqlTableFilter[] = Object.entries(filters)
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
				{data.rows.length === 0 && (
					<tr>
						<td
							colSpan={data.columns.length + 1}
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
									value === null ? 'italic text-(--vscode-descriptionForeground)' : '',
								)}
								title={value ?? 'NULL'}
							>
								{value ?? 'NULL'}
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
									className="border-0"
									style={{ width: 30, height: 30 }}
									disabled={!data.canEdit}
									title={data.canEdit ? 'Edit row' : data.editDisabledReason}
									onClick={() => preview.openUpdate(row)}
								>
									<Pencil size={14} />
								</IconButton>
								<IconButton
									className="border-0"
									style={{ width: 30, height: 30 }}
									disabled={!data.canEdit}
									title={data.canEdit ? 'Delete row' : data.editDisabledReason}
									onClick={() => preview.deleteRow(row.rowId)}
								>
									<Trash2 size={14} />
								</IconButton>
							</span>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function RowDialog({ preview }: { preview: PreviewState }) {
	const data = preview.data!;
	const dialog = preview.dialog!;
	const columns = data.columnInfo.filter(
		column => column.editable && !(dialog.mode === 'insert' && column.autoIncrement),
	);
	return (
		<Dialog
			title={dialog.mode === 'insert' ? 'Insert row' : 'Edit row'}
			onClose={preview.closeDialog}
			actions={
				dialog.sql ? (
					<>
						<PrimaryButton
							className="bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) hover:bg-(--vscode-button-secondaryHoverBackground)"
							onClick={preview.backToFields}
						>
							Back
						</PrimaryButton>
						<PrimaryButton onClick={preview.confirm}>Execute</PrimaryButton>
					</>
				) : (
					<PrimaryButton onClick={preview.preview}>Review SQL</PrimaryButton>
				)
			}
		>
			{dialog.sql ? (
				<SqlPreview sql={dialog.sql} />
			) : (
				<div className="grid gap-3">
					{columns.map(column => (
						<RowField key={column.name} column={column} preview={preview} />
					))}
				</div>
			)}
		</Dialog>
	);
}

function RowField({ column, preview }: { column: MysqlColumnInfo; preview: PreviewState }) {
	const dialog = preview.dialog!;
	const isNull = dialog.nulls.has(column.name);
	const useDefault = dialog.defaults.has(column.name);
	const disabled = isNull || useDefault;
	const value = dialog.values[column.name] ?? '';
	const control = column.boolean ? (
		<SelectInput
			disabled={disabled}
			value={value || 'false'}
			onChange={event => preview.setValue(column.name, event.target.value)}
		>
			<option value="false">false</option>
			<option value="true">true</option>
		</SelectInput>
	) : ['text', 'mediumtext', 'longtext', 'json'].includes(column.dataType.toLowerCase()) ? (
		<TextArea
			disabled={disabled}
			value={value}
			onChange={event => preview.setValue(column.name, event.target.value)}
		/>
	) : (
		<TextInput
			disabled={disabled}
			type={inputType(column.dataType)}
			required={dialog.mode === 'insert' && !column.nullable && !column.hasDefault}
			value={value}
			onChange={event => preview.setValue(column.name, event.target.value)}
		/>
	);
	return (
		<label>
			<span className="mb-1 flex items-center gap-3 text-xs font-semibold">
				<span>
					{column.name}
					<small className="ml-1 font-normal text-(--vscode-descriptionForeground)">
						{column.dataType}
					</small>
				</span>
				{column.nullable && (
					<span className="ml-auto font-normal">
						<input
							type="checkbox"
							checked={isNull}
							onChange={event => preview.toggleNull(column.name, event.target.checked)}
						/>{' '}
						NULL
					</span>
				)}
				{dialog.mode === 'insert' && column.hasDefault && (
					<span className="font-normal">
						<input
							type="checkbox"
							checked={useDefault}
							onChange={event => preview.toggleDefault(column.name, event.target.checked)}
						/>{' '}
						DEFAULT
					</span>
				)}
			</span>
			{control}
		</label>
	);
}

function inputType(dataType: string) {
	const type = dataType.toLowerCase();
	if (type === 'date') return 'date';
	if (type === 'time') return 'time';
	if (
		['tinyint', 'smallint', 'mediumint', 'int', 'bigint', 'decimal', 'float', 'double'].includes(
			type,
		)
	)
		return 'number';
	return 'text';
}
function Status({
	children,
	loading,
	error,
}: {
	children: React.ReactNode;
	loading?: boolean;
	error?: boolean;
}) {
	return (
		<div
			className={cn(
				'flex items-center justify-center gap-2 p-8',
				error ? 'text-(--vscode-errorForeground)' : 'text-(--vscode-descriptionForeground)',
			)}
		>
			{loading && <LoaderCircle className="animate-spin" size={17} />}
			{children}
		</div>
	);
}
