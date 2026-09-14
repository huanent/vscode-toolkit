import { useState, type ReactNode } from 'react';
import { Popover } from '../../../../components/ui/popover';
import { Tree } from '../../../../components/ui/tree';

export function ConnectionGroup({ name, count, filtered, first, last, onAction, children }: {
	name: string;
	count: number;
	filtered: boolean;
	first: boolean;
	last: boolean;
	onAction(type: string, id?: string): void;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	const [anchorPosition, setAnchorPosition] = useState({ x: 0, y: 0 });
	return (
		<>
			<Tree label={name} count={count} open={filtered || undefined}
				summaryProps={{
					onContextMenu: event => {
						event.preventDefault();
						setAnchorPosition({ x: event.clientX, y: event.clientY });
						setOpen(true);
					},
					onKeyDown: event => {
						if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
						event.preventDefault();
						const bounds = event.currentTarget.getBoundingClientRect();
						setAnchorPosition({ x: bounds.left, y: bounds.bottom });
						setOpen(true);
					},
				}}
			>
				{children}
			</Tree>
			<Popover open={open} onOpenChange={setOpen} anchorPosition={anchorPosition} label={`Actions for ${name}`}>
				<div className="min-w-40 p-1">
					{[
						{ type: 'groupUp', label: 'Move Up', disabled: filtered || first },
						{ type: 'groupDown', label: 'Move Down', disabled: filtered || last },
						{ type: 'groupRename', label: 'Rename', disabled: false },
						{ type: 'groupDelete', label: 'Delete', disabled: false },
					].map(action => (
						<button key={action.type} type="button" disabled={action.disabled}
							className="block w-full rounded-xs px-2 py-1.5 text-left text-sm hover:bg-(--vscode-menu-selectionBackground) hover:text-(--vscode-menu-selectionForeground) disabled:opacity-45"
							onClick={() => { setOpen(false); onAction(action.type, name); }}>
							{action.label}
						</button>
					))}
				</div>
			</Popover>
		</>
	);
}