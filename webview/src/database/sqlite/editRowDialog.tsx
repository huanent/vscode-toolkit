import { useId, useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Switch } from '../../components/ui/switch';
import { Button } from '../../components/ui/button';
import { Input as TextInput } from '../../components/ui/input';
import type { SqliteColumn } from './types';

export type { SqliteColumn } from './types';

interface EditRowDialogProps {
	columns: SqliteColumn[];
	row: unknown[];
	onCancel: () => void;
	onSave: (values: unknown[]) => Promise<string | undefined>;
}

type FieldValue = {
	value: string;
	isNull: boolean;
	original: unknown;
};

export function EditRowDialog({ columns, row, onCancel, onSave }: EditRowDialogProps) {
	const [fields, setFields] = useState<FieldValue[]>(() =>
		row.map(value => ({
			value: value instanceof Uint8Array ? '' : String(value ?? ''),
			isNull: value === null,
			original: value,
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
		const values = fields.map((field, index) => parseFieldValue(columns[index], field));
		const nextError = await onSave(values);
		if (nextError) setError(nextError);
	}

	return (
		<Dialog
			open
			onClose={onCancel}
			title="Edit row"
			actions={
				<>
					<Button variant="plain" onClick={onCancel}>
						Cancel
					</Button>
					<Button htmlType="submit" form={formId}>
						Save changes
					</Button>
				</>
			}
		>
			<form id={formId} onSubmit={submit} className="space-y-4">
				{columns.map((column, index) => {
					const field = fields[index];
					const blobValue = field.original instanceof Uint8Array ? field.original : undefined;
					return (
						<div key={column.name}>
							<div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
								<label
									htmlFor={`edit-field-${index}`}
									className="min-w-0 font-medium wrap-anywhere"
								>
									{column.name}
								</label>
								<span className="text-xs wrap-anywhere text-(--vscode-descriptionForeground)">
									{column.type || 'ANY'}
									{column.primaryKey ? ' · PRIMARY KEY' : ''}
								</span>
								<label className="ml-auto flex shrink-0 items-center gap-2 text-xs font-normal text-(--vscode-descriptionForeground)">
									<Switch
										checked={field.isNull}
										disabled={column.notNull || Boolean(blobValue)}
										onChange={event => updateField(index, { isNull: event.target.checked })}
									/>{' '}
									NULL
								</label>
							</div>
							<TextInput
								id={`edit-field-${index}`}
								value={blobValue ? `<BLOB ${blobValue.byteLength} bytes>` : field.value}
								disabled={field.isNull || Boolean(blobValue)}
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

function parseFieldValue(column: SqliteColumn, field: FieldValue): unknown {
	if (field.isNull) return null;
	if (field.original instanceof Uint8Array) return field.original;
	if (
		/\b(INT|REAL|FLOA|DOUB|NUMERIC|DECIMAL|BOOLEAN)\b/i.test(column.type) &&
		field.value.trim() !== ''
	) {
		const numericValue = Number(field.value);
		if (!Number.isNaN(numericValue)) return numericValue;
	}
	return field.value;
}
