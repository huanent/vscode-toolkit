import { Input, Select, Textarea } from '../../../../components/ui/input';
import type { MysqlColumnInfo } from '../../types';
import type { PreviewState } from './dataTable';

export function RowField({ column, preview }: { column: MysqlColumnInfo; preview: PreviewState }) {
	const dialog=preview.dialog!;
	const isNull=dialog.nulls.has(column.name);
	const useDefault=dialog.defaults.has(column.name);
	const disabled=isNull||useDefault;
	const value=dialog.values[column.name]??'';
	const control=column.boolean? (
		<Select
			disabled={disabled}
			value={value||'false'}
			onChange={event => preview.setValue(column.name, event.target.value)}
		>
			<option value="false">false</option>
			<option value="true">true</option>
		</Select>
	):['text', 'mediumtext', 'longtext', 'json'].includes(column.dataType.toLowerCase())? (
		<Textarea
			disabled={disabled}
			value={value}
			onChange={event => preview.setValue(column.name, event.target.value)}
		/>
	):(
		<Input
			disabled={disabled}
			type={inputType(column.dataType)}
			required={dialog.mode==='insert'&&!column.nullable&&!column.hasDefault}
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
				{column.nullable&&(
					<span className="ml-auto font-normal">
						<input
							type="checkbox"
							checked={isNull}
							onChange={event => preview.toggleNull(column.name, event.target.checked)}
						/>{' '}
						NULL
					</span>
				)}
				{dialog.mode==='insert'&&column.hasDefault&&(
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

export function inputType(dataType: string) {
	const type=dataType.toLowerCase();
	if(type==='date') return 'date';
	if(type==='time') return 'time';
	if(
		['tinyint', 'smallint', 'mediumint', 'int', 'bigint', 'decimal', 'float', 'double'].includes(
			type,
		)
	)
		return 'number';
	return 'text';
}
