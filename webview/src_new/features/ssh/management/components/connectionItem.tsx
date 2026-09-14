import { useState } from 'react';
import { Button, IconButton } from '../../../../components/ui/button';
import { Play } from '../../../../components/ui/icons';
import { ListItem } from '../../../../components/ui/list';
import { Popover } from '../../../../components/ui/popover';

export type Connection = { id: string; name: string; group: string; address: string; kind: string };

export function ConnectionItem({
	server,
	selected,
	filtered,
	onSelect,
	onAction,
}: {
	server: Connection;
	selected: boolean;
	filtered: boolean;
	onSelect(id: string): void;
	onAction(type: string, id: string): void;
}) {
	const [open, setOpen] = useState(false);
	const [anchorPosition, setAnchorPosition] = useState({ x: 0, y: 0 });
	return (
		<ListItem
			onContextMenu={event => {
				event.preventDefault();
				setAnchorPosition({ x: event.clientX, y: event.clientY });
				setOpen(true);
			}}
			onKeyDown={event => {
				if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
					event.preventDefault();
					const bounds = event.currentTarget.getBoundingClientRect();
					setAnchorPosition({ x: bounds.left, y: bounds.bottom });
					setOpen(true);
				}
			}}
			selected={selected}
			inline
			onSelect={() => onSelect(server.id)}
			description={server.address}
			actions={
				<>
					<IconButton
						size="sm"
						icon={<Play />}
						label={`Open ${server.name}`}
						onClick={() => {
							onSelect(server.id);
							onAction('connect', server.id);
						}}
					/>
					<Popover
						open={open}
						onOpenChange={setOpen}
						label={`Actions for ${server.name}`}
						placement="bottom-start"
						anchorPosition={anchorPosition}
					>
						<div className="grid min-w-40 p-1">
							{[
								['edit', 'Edit'],
								['duplicate', 'Duplicate'],
								['copyHost', 'Copy Host'],
								['up', 'Move Up'],
								['down', 'Move Down'],
								['export', 'Export'],
								['delete', 'Delete'],
							].map(([type, label]) => (
								<Button
									key={type}
									variant="text"
									disabled={filtered && (type === 'up' || type === 'down')}
									className="w-full justify-start"
									onClick={() => {
										setOpen(false);
										onAction(type, server.id);
									}}
								>
									{label}
								</Button>
							))}
						</div>
					</Popover>
				</>
			}
		>
			<span className="p-1">{server.name}</span>
		</ListItem>
	);
}
