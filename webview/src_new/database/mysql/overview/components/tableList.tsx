import { cn } from 'cn';
import { IconButton } from '../../../../components/ui/button';
import {
	Pencil,
	Plus,
	Trash2
} from '../../../../components/ui/icons';
import type { MysqlTableInfo } from '../../types';
import { useMysqlOverview } from '../hooks/useMysqlOverview';
import { Status } from './status';

export type MysqlState=ReturnType<typeof useMysqlOverview>;

export function TableList({ tables, mysql }: { tables: MysqlTableInfo[]; mysql: MysqlState }) {
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
								i===1||i===2? 'text-right':'text-left',
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

								label="Create table"
								disabled={!mysql.database}
								onClick={mysql.openCreate}
								icon={<Plus size="md" />} />
						</div>
					</th>
				</tr>
			</thead>
			<tbody>
				{mysql.loading||mysql.error||tables.length===0? (
					<tr>
						<td colSpan={5}>
							{mysql.loading? (
								<Status loading>Loading tables...</Status>
							):mysql.error? (
								<Status error>{mysql.error}</Status>
							):(
								<Status>No tables found.</Status>
							)}
						</td>
					</tr>
				):(
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
										if(event.key==='Enter'||event.key===' ') {
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
								{formatSize(table.dataSize+table.indexSize)}
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

										label="Edit table"
										onClick={() => mysql.openEdit(table.name)}
										icon={<Pencil size="md" />} />
									<IconButton

										label="Delete table"
										onClick={() => mysql.deleteTable(table.name)}
										icon={<Trash2 size="md" />} />
								</span>
							</td>
						</tr>
					))
				)}
			</tbody>
		</table>
	);
}

export const formatNumber=(value: number) => new Intl.NumberFormat().format(value);

export function formatSize(value: number) {
	if(!value) return '0 B';
	const units=['B', 'KB', 'MB', 'GB', 'TB'];
	const unit=Math.min(Math.floor(Math.log(value)/Math.log(1024)), units.length-1);
	return `${(value/1024**unit).toFixed(unit? 1:0)} ${units[unit]}`;
}

export function formatDate(value: string|null) {
	if(!value) return '—';
	const date=new Date(value.replace(' ', 'T'));
	return Number.isNaN(date.valueOf())? value:date.toLocaleString();
}
