import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Dialog } from '../../../components/ui/dialog';
import { Field } from '../../../components/ui/field';
import { Textarea, Input } from '../../../components/ui/input';
import type { ServerCommand } from '@/ssh/formProtocol';

export function CommandDialog({
	command,
	onClose,
	onSave,
}: {
	command?: ServerCommand;
	onClose: () => void;
	onSave: (command: ServerCommand) => void;
}) {
	const [draft, setDraft] = useState<ServerCommand>(command ?? { name: '', value: '' });
	const canSave = Boolean(draft.name.trim() && draft.value.trim());
	return (
		<Dialog
			open
			title={command ? 'Edit command' : 'Add command'}
			onClose={onClose}
			actions={
				<>
					<Button variant="plain" htmlType="button" onClick={onClose}>
						Cancel
					</Button>
					<Button htmlType="button" disabled={!canSave} onClick={() => onSave(draft)}>
						{command ? 'Save' : 'Add'}
					</Button>
				</>
			}
		>
			<div className="grid gap-4">
				<Field label="Name" required>
					{control => (
						<Input
							{...control}
							autoFocus
							required
							placeholder="Restart service"
							value={draft.name}
							onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
						/>
					)}
				</Field>
				<Field label="Script" required>
					{control => (
						<Textarea
							{...control}
							className="min-h-56"
							required
							spellCheck={false}
							placeholder="sudo systemctl restart app"
							value={draft.value}
							onChange={event => setDraft(current => ({ ...current, value: event.target.value }))}
						/>
					)}
				</Field>
			</div>
		</Dialog>
	);
}
