import { useEffect, useState } from 'react';
import { cn } from 'cn';
import { PrimaryButton, SecondaryButton } from '../../../../components/button';
import { TextInput } from '../../../../components/input';

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

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onCancel();
		};
		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [onCancel]);

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
		<div
			className="fixed inset-0 z-20 grid place-items-center bg-black/45 p-4"
			role="presentation"
			onMouseDown={event => {
				if (event.target === event.currentTarget) onCancel();
			}}
		>
			<form
				className="flex max-h-[min(680px,calc(100vh-32px))] w-[min(760px,calc(100vw-32px))] flex-col border border-(--vscode-panel-border) bg-(--vscode-editor-background) shadow-xl"
				role="dialog"
				aria-modal="true"
				aria-labelledby="table-dialog-title"
				onSubmit={submit}
			>
				<header className="flex min-h-12 shrink-0 items-center gap-2 border-b border-(--vscode-panel-border) px-4 py-2">
					<i className="codicon codicon-table" aria-hidden="true" />
					<h2 id="table-dialog-title" className="m-0 min-w-0 flex-1 text-lg font-semibold wrap-anywhere">
						{title}
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
				<div className="min-h-0 overflow-auto p-4">
					<label className="mb-4 block text-sm font-medium">
						Table name
						<TextInput
							autoFocus
							value={tableName}
							onChange={event => {
								setTableName(event.target.value);
								setError('');
							}}
							className="mt-2 font-normal"
						/>
					</label>
					<div className="overflow-x-auto pb-2">
					<div className={cn(columnGridClassName, 'mb-2 min-w-2xl text-xs font-medium text-(--vscode-descriptionForeground)')}>
						<span>Name</span>
						<span>Type</span>
						<span>Primary</span>
						<span>Not null</span>
						<span>Default</span>
						<span />
					</div>
					<div className="min-w-2xl space-y-2">
						{columns.map((column, index) => (
							<div
								key={index}
								className={columnGridClassName}
							>
								<input
									aria-label={`Column ${index + 1} name`}
									value={column.name}
									onChange={event => updateColumn(index, { name: event.target.value })}
									className="h-8 min-w-0 border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 outline-none focus:border-(--vscode-focusBorder)"
								/>
								<select
									aria-label={`Column ${index + 1} type`}
									value={column.type}
									onChange={event => updateColumn(index, { type: event.target.value })}
									className="h-8 border border-(--vscode-dropdown-border) bg-(--vscode-dropdown-background) px-2 text-(--vscode-dropdown-foreground)"
								>
									{columnTypes.map(type => (
										<option key={type}>{type}</option>
									))}
								</select>
								<input
									aria-label={`Column ${index + 1} primary key`}
									type="checkbox"
									checked={column.primaryKey}
									onChange={event => updateColumn(index, { primaryKey: event.target.checked })}
								/>
								<input
									aria-label={`Column ${index + 1} not null`}
									type="checkbox"
									checked={column.notNull}
									onChange={event => updateColumn(index, { notNull: event.target.checked })}
								/>
								<input
									aria-label={`Column ${index + 1} default value`}
									value={column.defaultValue}
									onChange={event => updateColumn(index, { defaultValue: event.target.value })}
									placeholder="NULL, 0, 'text'"
									className="h-8 min-w-0 border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 outline-none focus:border-(--vscode-focusBorder)"
								/>
								<button
									type="button"
									title="Remove column"
									disabled={columns.length === 1}
									className="grid size-7 place-items-center border-0 bg-transparent enabled:hover:bg-(--vscode-toolbar-hoverBackground) disabled:opacity-35"
									onClick={() =>
										setColumns(current => current.filter((_, columnIndex) => columnIndex !== index))
									}
								>
									<i className="codicon codicon-trash" aria-hidden="true" />
								</button>
							</div>
						))}
					</div>
					</div>
					<button
						type="button"
						className="mt-3 flex h-7 items-center gap-1 border-0 bg-transparent px-1 text-(--vscode-textLink-foreground) hover:text-(--vscode-textLink-activeForeground)"
						onClick={() => setColumns(current => [...current, createColumn()])}
					>
						<i className="codicon codicon-add" aria-hidden="true" /> Add column
					</button>
					{error && (
						<div className="mt-3 text-xs text-(--vscode-errorForeground)" role="alert">
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
						{submitLabel}
					</PrimaryButton>
				</footer>
			</form>
		</div>
	);
}
