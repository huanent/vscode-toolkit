import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../../../../components/button';
import { Dialog } from '../../../../components/dialog';
import { FieldLabel } from '../../../../components/field';
import { TextArea, TextInput } from '../../../../components/input';
import type { ServerCommand } from '../../../../../../src/features/ssh/formProtocol';

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
			title={command ? 'Edit command' : 'Add command'}
			onClose={onClose}
			actions={
				<>
					<SecondaryButton type="button" onClick={onClose}>
						Cancel
					</SecondaryButton>
					<PrimaryButton type="button" disabled={!canSave} onClick={() => onSave(draft)}>
						{command ? 'Save' : 'Add'}
					</PrimaryButton>
				</>
			}
		>
			<div className="grid gap-4">
				<label className="block min-w-0">
					<FieldLabel>
						Name<span className="ml-1 text-(--vscode-errorForeground)">*</span>
					</FieldLabel>
					<TextInput
						autoFocus
						required
						placeholder="Restart service"
						value={draft.name}
						onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
					/>
				</label>
				<label className="block min-w-0">
					<FieldLabel>
						Script<span className="ml-1 text-(--vscode-errorForeground)">*</span>
					</FieldLabel>
					<TextArea
						className="min-h-56"
						required
						spellCheck={false}
						placeholder="sudo systemctl restart app"
						value={draft.value}
						onChange={event => setDraft(current => ({ ...current, value: event.target.value }))}
					/>
				</label>
			</div>
		</Dialog>
	);
}
