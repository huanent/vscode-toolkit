import { IconButton } from '../../../../../components/ui/button';
import { Trash2 } from '../../../../../components/ui/icons';
import { Input, Select } from '../../../../../components/ui/input';
import type { MysqlColumnType, MysqlTableColumnDefinition } from '../../types';
import type { MysqlState } from '../hooks/useMysqlOverview';
const columnTypes: MysqlColumnType[]=[
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


export function ColumnDefinitionRow({ column, index, mysql, setColumn }: { column: MysqlTableColumnDefinition; index: number; mysql: MysqlState; setColumn(index: number, patch: Partial<MysqlTableColumnDefinition>): void }) {
	const definition=mysql.dialog!.definition;
	return (<tr key={`${column.originalName??'new'}-${index}`}>
		<td className="p-1">
			<Input
				required
				maxLength={64}
				value={column.name}
				onChange={event => setColumn(index, { name: event.target.value })}
			/>
		</td>
		<td className="p-1">
			<Select
				value={column.type}
				onChange={event =>
					setColumn(index, { type: event.target.value as MysqlColumnType })
				}
			>
				{columnTypes.map(type => (
					<option key={type}>{type}</option>
				))}
			</Select>
		</td>
		<td className="p-1">
			<Input
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
						nullable: event.target.checked? false:column.nullable,
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
						primaryKey: event.target.checked||column.primaryKey,
						nullable: event.target.checked? false:column.nullable,
						type:
							event.target.checked&&
								!['BIGINT', 'INT', 'SMALLINT', 'TINYINT'].includes(column.type)
								? 'BIGINT'
								:column.type,
					})
				}
			/>
		</td>
		<td className="p-1">
			<Select
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
			</Select>
		</td>
		<td className="p-1">
			<Input
				disabled={column.defaultKind!=='value'}
				value={column.defaultValue}
				onChange={event => setColumn(index, { defaultValue: event.target.value })}
			/>
		</td>
		<td className="p-1">
			<IconButton

				label="Remove column"
				onClick={() =>
					mysql.updateDefinition({
						...definition,
						columns: definition.columns.filter((_, current) => current!==index),
					})
				}
				icon={<Trash2 size="md" />} />
		</td>
	</tr>);
}
