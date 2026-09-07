import { useEffect } from 'react';
import type { DatabaseObject } from '../types';

interface TableContextMenuProps {
	object: DatabaseObject;
	x: number;
	y: number;
	onClose: () => void;
	onNewRow: (object: DatabaseObject) => void;
	onEditTable: (object: DatabaseObject) => void;
	onDeleteTable: (object: DatabaseObject) => void;
}

export function TableContextMenu({
	object,
	x,
	y,
	onClose,
	onNewRow,
	onEditTable,
	onDeleteTable,
}: TableContextMenuProps) {
	useEffect(() => {
		window.addEventListener('blur', onClose);
		document.addEventListener('pointerdown', onClose);
		return () => {
			window.removeEventListener('blur', onClose);
			document.removeEventListener('pointerdown', onClose);
		};
	}, [onClose]);

	const disabled = object.type !== 'table' || object.name.startsWith('sqlite_');
	return (
		<div
			className="fixed z-10 min-w-40 border border-(--vscode-menu-border,var(--vscode-panel-border)) bg-(--vscode-menu-background) p-1 shadow-[0_2px_8px_var(--vscode-widget-shadow)]"
			role="menu"
			style={{
				left: Math.min(x, window.innerWidth - 168),
				top: Math.min(y, window.innerHeight - 96),
			}}
			onPointerDown={event => event.stopPropagation()}
		>
			<button
				type="button"
				role="menuitem"
				disabled={disabled}
				className="flex h-7 w-full items-center border-0 bg-transparent px-2 text-left text-(--vscode-menu-foreground) enabled:hover:bg-(--vscode-menu-selectionBackground) enabled:hover:text-(--vscode-menu-selectionForeground) disabled:opacity-45"
				onClick={() => {
					onNewRow(object);
					onClose();
				}}
			>
				New data
			</button>
			<button
				type="button"
				role="menuitem"
				disabled={disabled}
				className="flex h-7 w-full items-center border-0 bg-transparent px-2 text-left text-(--vscode-menu-foreground) enabled:hover:bg-(--vscode-menu-selectionBackground) enabled:hover:text-(--vscode-menu-selectionForeground) disabled:opacity-45"
				onClick={() => {
					onEditTable(object);
					onClose();
				}}
			>
				Edit table
			</button>
			<div
				className="mx-1 my-1 h-px bg-(--vscode-menu-separatorBackground,var(--vscode-panel-border))"
				role="separator"
			/>
			<button
				type="button"
				role="menuitem"
				disabled={disabled}
				className="flex h-7 w-full items-center border-0 bg-transparent px-2 text-left text-(--vscode-errorForeground) enabled:hover:bg-(--vscode-menu-selectionBackground) enabled:hover:text-(--vscode-menu-selectionForeground) disabled:opacity-45"
				onClick={() => {
					onDeleteTable(object);
					onClose();
				}}
			>
				Delete table
			</button>
		</div>
	);
}
