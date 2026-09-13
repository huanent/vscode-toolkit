import { useState, type ReactNode } from 'react';
import { ChevronRight } from '../../../../components/ui/icons';
import { Popover } from '../../../../components/ui/popover';

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
			<details open={filtered || undefined} className="group">
				<summary
					className="flex cursor-pointer list-none items-center gap-1 rounded-xs p-1 text-xs font-semibold hover:bg-(--vscode-list-hoverBackground) [&::-webkit-details-marker]:hidden"
					onContextMenu={event => {
						event.preventDefault();
						setAnchorPosition({ x: event.clientX, y: event.clientY });
						setOpen(true);
					}}
					onKeyDown={event => {
						if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
						event.preventDefault();
						const bounds = event.currentTarget.getBoundingClientRect();
						setAnchorPosition({ x: bounds.left, y: bounds.bottom });
						setOpen(true);
					}}
				>
					<ChevronRight className="group-open:rotate-90" size="sm" />
					<span className="min-w-0 flex-1 wrap-anywhere">{name}</span>
					<span className="p-1">{count}</span>
				</summary>
				<div className="ml-2.5 border-l border-(--vscode-tree-indentGuidesStroke) pl-2">{children}</div>
			</details>
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