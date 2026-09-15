import { useId, useState } from 'react';
import { cn } from 'cn';
import { Button, IconButton } from '../../components/ui/button';
import { Input, Select } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Dialog } from '../../components/ui/dialog';
import { Plus, Trash2 } from '../../components/ui/icons';

export type TableColumn = {
	name: string;
	type: string;
	primaryKey: boolean;
	notNull: boolean;
	defaultValue: string;
	originalName?: string;
};

interface CreateTableDialogProps {
	onCancel: () => void;
	onCreate: (tableName: string, columns: TableColumn[]) => Promise<string | undefined>;
	title?: string;
	submitLabel?: string;
	initialTableName?: string;
	initialColumns?: TableColumn[];
}

const columnTypes = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC'];
const columnGridClassName =
	'grid grid-cols-[minmax(9rem,1fr)_9rem_5rem_5.5rem_minmax(9rem,1fr)_2rem] items-center gap-2';

function createColumn(): TableColumn {
	return { name: '', type: 'TEXT', primaryKey: false, notNull: false, defaultValue: '' };
}

export function CreateTableDialog({
	onCancel,
	onCreate,
	title = 'Create table',
	submitLabel = 'Create',
	initialTableName = '',
	initialColumns,
}: CreateTableDialogProps) {
	const [tableName, setTableName] = useState(initialTableName);
	const [columns, setColumns] = useState<TableColumn[]>(initialColumns ?? [createColumn()]);
	const [error, setError] = useState('');

	const formId = useId();

	function updateColumn(index: number, changes: Partial<TableColumn>) {
		setColumns(current =>
			current.map((column, columnIndex) =>
				columnIndex === index ? { ...column, ...changes } : column,
			),
		);
	}

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		const nextError = await onCreate(
			tableName.trim(),
			columns.map(column => ({ ...column, name: column.name.trim() })),
		);
		if (nextError) setError(nextError);
	}

	return (
		<Dialog
			open
			onClose={onCancel}
			title={title}
			size="lg"
			actions={
				<>
					<Button variant="plain" onClick={onCancel}>
						Cancel
					</Button>
					<Button htmlType="submit" form={formId}>
						{submitLabel}
					</Button>
				</>
			}
		>
			<form id={formId} onSubmit={submit}>
				<label className="mb-4 block text-sm font-medium">
					Table name
					<Input
						autoFocus
						value={tableName}
						onChange={event => {
							setTableName(event.target.value);
							setError('');
						}}
					/>
				</label>
				<div className="overflow-x-auto pb-2">
					<div
						className={cn(
							columnGridClassName,
							'mb-2 min-w-2xl text-xs font-medium text-(--vscode-descriptionForeground)',
						)}
					>
						<span>Name</span>
						<span>Type</span>
						<span>Primary</span>
						<span>Not null</span>
						<span>Default</span>
						<span />
					</div>
					<div className="min-w-2xl space-y-2">
						{columns.map((column, index) => (
							<div key={index} className={columnGridClassName}>
								<Input
									aria-label={`Column ${index + 1} name`}
									value={column.name}
									onChange={event => updateColumn(index, { name: event.target.value })}
								/>
								<Select
									aria-label={`Column ${index + 1} type`}
									value={column.type}
									onChange={event => updateColumn(index, { type: event.target.value })}
								>
									{columnTypes.map(type => (
										<option key={type}>{type}</option>
									))}
								</Select>
								<Switch
									aria-label={`Column ${index + 1} primary key`}
									checked={column.primaryKey}
									onChange={event => updateColumn(index, { primaryKey: event.target.checked })}
								/>
								<Switch
									aria-label={`Column ${index + 1} not null`}
									checked={column.notNull}
									onChange={event => updateColumn(index, { notNull: event.target.checked })}
								/>
								<Input
									aria-label={`Column ${index + 1} default value`}
									value={column.defaultValue}
									onChange={event => updateColumn(index, { defaultValue: event.target.value })}
									placeholder="NULL, 0, 'text'"
								/>
								<IconButton
									icon={<Trash2 />}
									label="Remove column"
									disabled={columns.length === 1}
									onClick={() =>
										setColumns(current => current.filter((_, columnIndex) => columnIndex !== index))
									}
								/>
							</div>
						))}
					</div>
				</div>
				<Button
					variant="text"
					left={<Plus />}
					onClick={() => setColumns(current => [...current, createColumn()])}
				>
					Add column
				</Button>
				{error && (
					<div className="mt-3 text-xs text-(--vscode-errorForeground)" role="alert">
						{error}
					</div>
				)}
			</form>
		</Dialog>
	);
}
