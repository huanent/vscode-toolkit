import { useEffect, useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../../../../components/button';
import { TextInput } from '../../../../components/input';
import type { SqliteColumn } from './EditRowDialog';

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

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onCancel();
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [onCancel]);

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
		<div
			className="fixed inset-0 z-20 grid place-items-center bg-black/45 p-4"
			role="presentation"
			onMouseDown={event => {
				if (event.target === event.currentTarget) onCancel();
			}}
		>
			<form
				className="flex max-h-[min(720px,calc(100vh-32px))] w-[min(560px,calc(100vw-32px))] flex-col border border-(--vscode-panel-border) bg-(--vscode-editor-background) shadow-xl"
				role="dialog"
				aria-modal="true"
				aria-labelledby="new-row-title"
				onSubmit={submit}
			>
				<header className="flex min-h-12 shrink-0 items-center gap-2 border-b border-(--vscode-panel-border) px-4 py-2">
					<i className="codicon codicon-add" aria-hidden="true" />
					<h2
						id="new-row-title"
						className="m-0 min-w-0 flex-1 text-lg font-semibold wrap-anywhere"
					>
						New data · {tableName}
					</h2>
					<button
						type="button"
						title="Close"
						className="grid size-7 place-items-center border-0 bg-transparent hover:bg-(--vscode-toolbar-hoverBackground)"
						onClick={onCancel}
					>
						<i className="codicon codicon-close" aria-hidden="true" />
					</button>
				</header>
				<div className="min-h-0 space-y-4 overflow-auto p-4">
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
										<input
											type="checkbox"
											checked={field.useDefault}
											onChange={event => updateField(index, { useDefault: event.target.checked })}
										/>{' '}
										Default
									</label>
									<label className="flex shrink-0 items-center gap-2 text-xs font-normal text-(--vscode-descriptionForeground)">
										<input
											type="checkbox"
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
									className="disabled:opacity-60"
								/>
							</div>
						);
					})}
					{error && (
						<div className="text-xs text-(--vscode-errorForeground)" role="alert">
							{error}
						</div>
					)}
				</div>
				<footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-(--vscode-panel-border) px-4 py-3">
					<SecondaryButton
						type="button"
						onClick={onCancel}
					>
						Cancel
					</SecondaryButton>
					<PrimaryButton type="submit">
						Create
					</PrimaryButton>
				</footer>
			</form>
		</div>
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
