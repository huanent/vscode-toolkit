import { useId, useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Switch } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { Input as TextInput } from '../../components/ui/input';
import type { SqliteColumn } from './editRowDialog';

export type NewRowValue = {
	column: SqliteColumn;
	value: unknown;
};

interface NewRowDialogProps {
	tableName: string;
	columns: SqliteColumn[];
	onCancel: () => void;
	onCreate: (values: NewRowValue[]) => Promise<string | undefined>;
}

type FieldValue = {
	value: string;
	isNull: boolean;
	useDefault: boolean;
};

export function NewRowDialog({ tableName, columns, onCancel, onCreate }: NewRowDialogProps) {
	const [fields, setFields] = useState<FieldValue[]>(() =>
		columns.map(column => ({
			value: '',
			isNull: !column.notNull && !column.primaryKey && column.defaultValue === null,
			useDefault: column.defaultValue !== null || (column.primaryKey && /INT/i.test(column.type)),
		})),
	);
	const [error, setError] = useState('');

	const formId = useId();

	function updateField(index: number, changes: Partial<FieldValue>) {
		setFields(current =>
			current.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...changes } : field)),
		);
		setError('');
	}

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		const values = fields.flatMap((field, index): NewRowValue[] =>
			field.useDefault
				? []
				: [
					{
						column: columns[index],
						value: parseValue(columns[index], field),
					},
				],
		);
		const nextError = await onCreate(values);
		if (nextError) setError(nextError);
	}

	return (
		<Dialog
			open
			onClose={onCancel}
			title={`New data · ${tableName}`}
			actions={
				<>
					<Button variant="plain" onClick={onCancel}>
						Cancel
					</Button>
					<Button htmlType="submit" form={formId}>
						Create
					</Button>
				</>
			}
		>
			<form id={formId} onSubmit={submit} className="space-y-4">
				{columns.map((column, index) => {
					const field = fields[index];
					return (
						<div key={column.name}>
							<div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
								<label htmlFor={`new-field-${index}`} className="min-w-0 font-medium wrap-anywhere">
									{column.name}
								</label>
								<span className="text-xs wrap-anywhere text-(--vscode-descriptionForeground)">
									{column.type || 'ANY'}
									{column.primaryKey ? ' · PRIMARY KEY' : ''}
								</span>
								<label className="ml-auto flex shrink-0 items-center gap-2 text-xs font-normal text-(--vscode-descriptionForeground)">
									<Switch
										checked={field.useDefault}
										onChange={event => updateField(index, { useDefault: event.target.checked })}
									/>{' '}
									Default
								</label>
								<label className="flex shrink-0 items-center gap-2 text-xs font-normal text-(--vscode-descriptionForeground)">
									<Switch
										checked={field.isNull}
										disabled={column.notNull || field.useDefault}
										onChange={event => updateField(index, { isNull: event.target.checked })}
									/>{' '}
									NULL
								</label>
							</div>
							<TextInput
								id={`new-field-${index}`}
								value={field.value}
								disabled={field.isNull || field.useDefault}
								placeholder={field.useDefault ? (column.defaultValue ?? 'Automatic') : ''}
								onChange={event => updateField(index, { value: event.target.value })}
							/>
						</div>
					);
				})}
				{error && (
					<div className="text-xs text-(--vscode-errorForeground)" role="alert">
						{error}
					</div>
				)}
			</form>
		</Dialog>
	);
}

function parseValue(column: SqliteColumn, field: FieldValue): unknown {
	if (field.isNull) return null;
	if (
		/\b(INT|REAL|FLOA|DOUB|NUMERIC|DECIMAL|BOOLEAN)\b/i.test(column.type) &&
		field.value.trim() !== ''
	) {
		const numericValue = Number(field.value);
		if (!Number.isNaN(numericValue)) return numericValue;
	}
	return field.value;
}
