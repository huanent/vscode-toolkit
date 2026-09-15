import { useState } from 'react';
import { Button, IconButton } from '../../../components/ui/button';
import { List, ListItem } from '../../../components/ui/list';
import { Pencil, Plus, Trash2 } from '../../../components/ui/icons';
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
			{commands.length > 0 && (
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
										htmlType="button"
										label="Edit command"

										onClick={() => setEditingIndex(index)}
										icon={<Pencil size="md" />}
									/>
									<IconButton
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
			<Button
				variant="plain"
				className="mt-3 w-full"
				aria-label="Add command"
				title="Add command"
				left={<Plus size="md" />}
				onClick={() => setEditingIndex('new')}
			/>
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
