import { Button } from '../../../../../components/ui/button';
import { Dialog } from '../../../../../components/ui/dialog';
import {
	Plus
} from '../../../../../components/ui/icons';
import { Input } from '../../../../../components/ui/input';
import { SqlPreview } from '../../../components/sqlPreview';
import type { MysqlTableColumnDefinition } from '../../types';
import { ColumnDefinitionRow } from './columnDefinitionRow';
import { Status } from './status';
import type { MysqlState } from './tableList';

export function TableDefinitionDialog({ mysql }: { mysql: MysqlState }) {
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
		<Dialog open size="lg"
			title={`${dialog.mode === 'create' ? 'Create' : 'Edit'} table`}
			onClose={mysql.closeDialog}
			actions={
				dialog.sql ? (
					<>
						<Button variant="plain" onClick={mysql.backToFields}>Back</Button>
						<Button onClick={mysql.confirm}>Execute</Button>
					</>
				) : (
					<Button disabled={dialog.loading} onClick={mysql.preview}>
						Review SQL
					</Button>
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
						<Input
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
									<ColumnDefinitionRow key={`${column.originalName ?? 'new'}-${index}`} column={column} index={index} mysql={mysql} setColumn={setColumn} />
								))}
							</tbody>
						</table>
					</div>
					<Button
						variant="plain"
						onClick={mysql.addColumn}
					>
						<Plus size="md" />
						Add column
					</Button>
				</div>
			)}
		</Dialog>
	);
}
