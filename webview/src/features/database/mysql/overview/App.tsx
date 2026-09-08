import { cn } from 'cn';
import {
	Download,
	LoaderCircle,
	Pencil,
	Plus,
	RefreshCw,
	Gist,
	Trash2,
	Upload,
} from '../../../../components/ui/icons';
import { IconButton, PrimaryButton, SecondaryButton } from '../../../../components/ui/button';
import { Dialog } from '../../../../components/ui/dialog';
import { SelectInput, TextInput } from '../../../../components/ui/input';
import { SqlPreview } from '../../components/SqlPreview';
import type { MysqlColumnType, MysqlTableColumnDefinition, MysqlTableInfo } from '../types';
import { useMysqlOverview } from './useMysqlOverview';

const columnTypes: MysqlColumnType[] = [
	'BIGINT',
	'INT',
	'SMALLINT',
	'TINYINT',
	'BIT',
	'DECIMAL',
	'VARCHAR',
	'CHAR',
	'TEXT',
	'LONGTEXT',
	'BOOLEAN',
	'DATE',
	'DATETIME',
	'TIMESTAMP',
	'TIME',
	'JSON',
	'BLOB',
];

export function App() {
	const mysql = useMysqlOverview();
	if (!mysql.server)
		return (
			<div className="grid h-screen place-items-center">
				<LoaderCircle className="animate-spin" />
			</div>
		);
	return (
		<div className="grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden text-[0.9em]">
			<header className="flex min-w-0 items-center gap-2 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) px-1 pt-0 pb-1">
				<SelectInput
					aria-label="Database"
					className="min-w-0 max-w-64 flex-1"
					value={mysql.database}
					onChange={event => mysql.setDatabase(event.target.value)}
				>
					{!mysql.database && <option value="">No database</option>}
					{mysql.databases.map(database => (
						<option key={database}>{database}</option>
					))}
				</SelectInput>
				<div className="flex shrink-0 gap-1">
					<IconButton className="border-0" title="Create database" onClick={mysql.createDatabase}>
						<Plus size={16} />
					</IconButton>
					<IconButton
						className="border-0"
						title="Delete database"
						disabled={!mysql.database}
						onClick={mysql.deleteDatabase}
					>
						<Trash2 size={16} />
					</IconButton>
				</div>
				<div className="ml-auto flex shrink-0 gap-1">
					<IconButton
						className="border-0"
						title="Open SQL editor"
						disabled={!mysql.database}
						onClick={mysql.openSql}
					>
						<Gist size={16} />
					</IconButton>
					<IconButton className="border-0" title="Import database" onClick={mysql.importDatabase}>
						<Download size={16} />
					</IconButton>
					<IconButton
						className="border-0"
						title="Export database"
						disabled={!mysql.database}
						onClick={mysql.exportDatabase}
					>
						<Upload size={16} />
					</IconButton>
					<IconButton className="border-0" title="Refresh" onClick={mysql.refresh}>
						<RefreshCw size={16} />
					</IconButton>
				</div>
			</header>
			<main className="min-h-0 min-w-0 overflow-auto">
				<TableList tables={mysql.tables} mysql={mysql} />
			</main>
			{mysql.dialog && <TableDefinitionDialog mysql={mysql} />}
		</div>
	);
}

type MysqlState = ReturnType<typeof useMysqlOverview>;
function TableList({ tables, mysql }: { tables: MysqlTableInfo[]; mysql: MysqlState }) {
	return (
		<table
			aria-label="Tables"
			className="w-full min-w-160 table-fixed border-separate border-spacing-0"
		>
			<colgroup>
				<col />
				<col className="w-22" />
				<col className="w-24" />
				<col className="w-40" />
				<col className="w-20" />
			</colgroup>
			<thead>
				<tr>
					{['Name', 'Rows', 'Data', 'Updated'].map((value, i) => (
						<th
							key={i}
							className={cn(
								'sticky top-0 z-10 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) bg-(--vscode-editor-background) px-3 py-2 text-xs font-medium text-(--vscode-descriptionForeground)',
								i === 1 || i === 2 ? 'text-right' : 'text-left',
							)}
						>
							{value}
						</th>
					))}
					<th
						aria-label="Actions"
						className="sticky top-0 z-10 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) bg-(--vscode-editor-background) p-1"
					>
						<div className="flex justify-end">
							<IconButton
								className="border-0"
								title="Create table"
								disabled={!mysql.database}
								onClick={mysql.openCreate}
							>
								<Plus size={16} />
							</IconButton>
						</div>
					</th>
				</tr>
			</thead>
			<tbody>
				{mysql.loading || mysql.error || tables.length === 0 ? (
					<tr>
						<td colSpan={5}>
							{mysql.loading ? (
								<Status loading>Loading tables...</Status>
							) : mysql.error ? (
								<Status error>{mysql.error}</Status>
							) : (
								<Status>No tables found.</Status>
							)}
						</td>
					</tr>
				) : (
					tables.map(table => (
						<tr
							key={table.name}
							className="hover:bg-(--vscode-list-hoverBackground)"
							onDoubleClick={() => mysql.openTable(table.name)}
						>
							<td className="px-3 py-2">
								<button
									title={table.name}
									className="block w-full truncate border-0 bg-transparent text-left font-medium"
									onKeyDown={event => {
										if (event.key === 'Enter' || event.key === ' ') {
											event.preventDefault();
											mysql.openTable(table.name);
										}
									}}
								>
									{table.name}
								</button>
							</td>
							<td className="px-3 py-2 text-right tabular-nums">{formatNumber(table.rowCount)}</td>
							<td className="px-3 py-2 text-right tabular-nums">
								{formatSize(table.dataSize + table.indexSize)}
							</td>
							<td
								className="truncate px-3 py-2 text-xs text-(--vscode-descriptionForeground)"
								title={formatDate(table.updatedAt)}
							>
								{formatDate(table.updatedAt)}
							</td>
							<td className="p-1" onDoubleClick={event => event.stopPropagation()}>
								<span className="flex justify-end">
									<IconButton
										className="border-0"
										title="Edit table"
										onClick={() => mysql.openEdit(table.name)}
									>
										<Pencil size={15} />
									</IconButton>
									<IconButton
										className="border-0"
										title="Delete table"
										onClick={() => mysql.deleteTable(table.name)}
									>
										<Trash2 size={15} />
									</IconButton>
								</span>
							</td>
						</tr>
					))
				)}
			</tbody>
		</table>
	);
}

function TableDefinitionDialog({ mysql }: { mysql: MysqlState }) {
	const dialog = mysql.dialog!;
	const definition = dialog.definition;
	const setColumn = (index: number, patch: Partial<MysqlTableColumnDefinition>) =>
		mysql.updateDefinition({
			...definition,
			columns: definition.columns.map((column, current) =>
				current === index ? { ...column, ...patch } : column,
			),
		});
	return (
		<Dialog
			wide
			title={`${dialog.mode === 'create' ? 'Create' : 'Edit'} table`}
			onClose={mysql.closeDialog}
			actions={
				dialog.sql ? (
					<>
						<SecondaryButton onClick={mysql.backToFields}>Back</SecondaryButton>
						<PrimaryButton onClick={mysql.confirm}>Execute</PrimaryButton>
					</>
				) : (
					<PrimaryButton disabled={dialog.loading} onClick={mysql.preview}>
						Review SQL
					</PrimaryButton>
				)
			}
		>
			{dialog.loading ? (
				<Status loading>Loading definition...</Status>
			) : dialog.sql ? (
				<SqlPreview sql={dialog.sql} />
			) : (
				<div className="grid gap-3">
					<label>
						<span className="mb-1 block text-xs font-semibold">Table name</span>
						<TextInput
							required
							maxLength={64}
							value={definition.name}
							onChange={event =>
								mysql.updateDefinition({ ...definition, name: event.target.value })
							}
						/>
					</label>
					<div className="overflow-auto">
						<table className="w-full min-w-215 border-collapse">
							<thead>
								<tr>
									{[
										'Name',
										'Type',
										'Length',
										'Null',
										'Primary',
										'Auto',
										'Default',
										'Value',
										'',
									].map(value => (
										<th
											key={value}
											className="border-b border-(--vscode-panel-border,var(--vscode-widget-border)) p-1 text-left text-xs font-normal"
										>
											{value}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{definition.columns.map((column, index) => (
									<tr key={`${column.originalName ?? 'new'}-${index}`}>
										<td className="p-1">
											<TextInput
												required
												maxLength={64}
												value={column.name}
												onChange={event => setColumn(index, { name: event.target.value })}
											/>
										</td>
										<td className="p-1">
											<SelectInput
												value={column.type}
												onChange={event =>
													setColumn(index, { type: event.target.value as MysqlColumnType })
												}
											>
												{columnTypes.map(type => (
													<option key={type}>{type}</option>
												))}
											</SelectInput>
										</td>
										<td className="p-1">
											<TextInput
												disabled={!['BIT', 'DECIMAL', 'VARCHAR', 'CHAR'].includes(column.type)}
												value={column.length}
												onChange={event => setColumn(index, { length: event.target.value })}
											/>
										</td>
										<td className="p-1 text-center">
											<input
												type="checkbox"
												checked={column.nullable}
												disabled={column.primaryKey}
												onChange={event => setColumn(index, { nullable: event.target.checked })}
											/>
										</td>
										<td className="p-1 text-center">
											<input
												type="checkbox"
												checked={column.primaryKey}
												onChange={event =>
													setColumn(index, {
														primaryKey: event.target.checked,
														nullable: event.target.checked ? false : column.nullable,
													})
												}
											/>
										</td>
										<td className="p-1 text-center">
											<input
												type="checkbox"
												checked={column.autoIncrement}
												onChange={event =>
													setColumn(index, {
														autoIncrement: event.target.checked,
														primaryKey: event.target.checked || column.primaryKey,
														nullable: event.target.checked ? false : column.nullable,
														type:
															event.target.checked &&
															!['BIGINT', 'INT', 'SMALLINT', 'TINYINT'].includes(column.type)
																? 'BIGINT'
																: column.type,
													})
												}
											/>
										</td>
										<td className="p-1">
											<SelectInput
												value={column.defaultKind}
												onChange={event =>
													setColumn(index, {
														defaultKind: event.target
															.value as MysqlTableColumnDefinition['defaultKind'],
													})
												}
											>
												<option value="none">None</option>
												<option value="null">NULL</option>
												<option value="currentTimestamp">Current time</option>
												<option value="value">Value</option>
											</SelectInput>
										</td>
										<td className="p-1">
											<TextInput
												disabled={column.defaultKind !== 'value'}
												value={column.defaultValue}
												onChange={event => setColumn(index, { defaultValue: event.target.value })}
											/>
										</td>
										<td className="p-1">
											<IconButton
												className="border-0"
												title="Remove column"
												onClick={() =>
													mysql.updateDefinition({
														...definition,
														columns: definition.columns.filter((_, current) => current !== index),
													})
												}
											>
												<Trash2 size={14} />
											</IconButton>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<PrimaryButton
						className="justify-self-start bg-(--vscode-button-secondaryBackground) text-(--vscode-button-secondaryForeground) hover:bg-(--vscode-button-secondaryHoverBackground)"
						onClick={mysql.addColumn}
					>
						<Plus size={15} />
						Add column
					</PrimaryButton>
				</div>
			)}
		</Dialog>
	);
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
				'flex items-center justify-center gap-2 p-8 text-center',
				error ? 'text-(--vscode-errorForeground)' : 'text-(--vscode-descriptionForeground)',
			)}
		>
			{loading && <LoaderCircle className="animate-spin" size={17} />}
			{children}
		</div>
	);
}
const formatNumber = (value: number) => new Intl.NumberFormat().format(value);
function formatSize(value: number) {
	if (!value) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const unit = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
	return `${(value / 1024 ** unit).toFixed(unit ? 1 : 0)} ${units[unit]}`;
}
function formatDate(value: string | null) {
	if (!value) return '—';
	const date = new Date(value.replace(' ', 'T'));
	return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}
