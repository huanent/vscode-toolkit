import { useState } from 'react';
import { IconButton } from '../../components/button';
import { Pencil, Plus, Trash2 } from '../../components/icons';
import type { ServerFormState } from '../hooks/useServerForm';
import { CommandDialog } from './CommandDialog';

export function CommandFields({ form }: { form: ServerFormState }) {
	const commands = form.values.commands;
	const [editingIndex, setEditingIndex] = useState<number | 'new'>();
	const saveCommand = (command: (typeof commands)[number]) => {
		form.update(
			'commands',
			editingIndex === 'new'
				? [...commands, command]
				: commands.map((current, index) => (index === editingIndex ? command : current)),
		);
		setEditingIndex(undefined);
	};
	return (
		<section aria-labelledby="commands-heading">
			<div className="mb-3.5 flex items-center justify-between gap-3">
				<h2 className="m-0 text-sm font-semibold" id="commands-heading">
					Commands
				</h2>
				<IconButton
					type="button"
					title="Add command"
					aria-label="Add command"
					onClick={() => setEditingIndex('new')}
				>
					<Plus size={16} />
				</IconButton>
			</div>
			{commands.length === 0 ? (
				<div className="border border-dashed border-(--vscode-panel-border,var(--vscode-widget-border)) px-4 py-8 text-center text-sm text-(--vscode-descriptionForeground)">
					No commands configured.
				</div>
			) : (
				<div className="divide-y divide-(--vscode-panel-border,var(--vscode-widget-border)) border-y border-(--vscode-panel-border,var(--vscode-widget-border))">
					{commands.map((command, index) => (
						<div
							className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5"
							key={index}
						>
							<button
								className="flex min-w-0 items-baseline gap-3 overflow-hidden border-0 bg-transparent px-1 text-left"
								type="button"
								onClick={() => setEditingIndex(index)}
							>
								<strong className="shrink-0 text-sm whitespace-nowrap">{command.name}</strong>
								<span className="min-w-0 overflow-hidden font-(family-name:--vscode-editor-font-family) text-xs text-ellipsis whitespace-nowrap text-(--vscode-descriptionForeground)">
									{command.value.replace(/\s+/g, ' ')}
								</span>
							</button>
							<span className="flex gap-1">
								<IconButton
									className="border-0"
									type="button"
									title="Edit command"
									aria-label="Edit command"
									onClick={() => setEditingIndex(index)}
								>
									<Pencil size={15} />
								</IconButton>
								<IconButton
									className="border-0"
									type="button"
									title="Remove command"
									aria-label="Remove command"
									onClick={() =>
										form.update(
											'commands',
											commands.filter((_, commandIndex) => commandIndex !== index),
										)
									}
								>
									<Trash2 size={15} />
								</IconButton>
							</span>
						</div>
					))}
				</div>
			)}
			{editingIndex !== undefined && (
				<CommandDialog
					command={editingIndex === 'new' ? undefined : commands[editingIndex]}
					onClose={() => setEditingIndex(undefined)}
					onSave={saveCommand}
				/>
			)}
		</section>
	);
}
