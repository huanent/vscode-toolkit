import { useState } from 'react';
import { IconButton } from '../../../../components/ui/button';
import { Empty } from '../../../../components/ui/empty';
import { List, ListItem } from '../../../../components/ui/list';
import { Pencil, Plus, Trash2 } from '../../../../components/ui/icons';
import type { ConnectionFormState } from '../hooks/useConnectionForm';
import { CommandDialog } from './commandDialog';

export function CommandFields({ form }: { form: ConnectionFormState }) {
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
					htmlType="button"
					label="Add command"

					onClick={() => setEditingIndex('new')}
					icon={<Plus size="md" />}
				/>
			</div>
			{commands.length === 0 ? (
				<Empty title="No commands configured." />
			) : (
				<List>
					{commands.map((command, index) => (
						<ListItem
							key={index}
							onSelect={() => setEditingIndex(index)}
							inline
							description={command.value.replace(/\s+/g, ' ')}
							actions={
								<>
									<IconButton
										size="sm"
										htmlType="button"
										label="Edit command"

										onClick={() => setEditingIndex(index)}
										icon={<Pencil size="md" />}
									/>
									<IconButton
										size="sm"
										htmlType="button"
										label="Remove command"

										onClick={() =>
											form.update(
												'commands',
												commands.filter((_, commandIndex) => commandIndex !== index),
											)
										}
										icon={<Trash2 size="md" />}
									/>
								</>
							}
						>
							{command.name}
						</ListItem>
					))}
				</List>
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
