import { cn } from 'cn';
import type { MouseEvent } from 'react';
import type { DatabaseObject } from '../types';

interface DatabaseSidebarProps {
	objects: DatabaseObject[];
	selectedObject: DatabaseObject | null;
	onCreateTable: () => void;
	onOpenObject: (object: DatabaseObject) => void;
	onOpenContextMenu: (object: DatabaseObject, event: MouseEvent<HTMLButtonElement>) => void;
}

export function DatabaseSidebar({
	objects,
	selectedObject,
	onCreateTable,
	onOpenObject,
	onOpenContextMenu,
}: DatabaseSidebarProps) {
	return (
		<aside
			className="flex min-h-0 flex-col border-r border-(--vscode-panel-border) bg-(--vscode-sideBar-background)"
			aria-label="Database objects"
		>
			<div className="flex h-8 shrink-0 items-center border-b border-(--vscode-panel-border) px-2">
				<span className="flex-1 text-[11px] font-semibold uppercase text-(--vscode-descriptionForeground)">
					Tables
				</span>
				<button
					type="button"
					title="Create table"
					className="grid size-6 place-items-center border-0 bg-transparent hover:bg-(--vscode-toolbar-hoverBackground)"
					onClick={onCreateTable}
				>
					<i className="codicon codicon-add" aria-hidden="true" />
				</button>
			</div>
			<div className="min-h-0 flex-1 overflow-auto py-1">
				{objects.map(object => (
					<button
						key={`${object.type}:${object.name}`}
						type="button"
						className={cn(
							'flex h-7 w-full items-center gap-2 border-0 px-3 text-left text-xs',
							selectedObject?.name === object.name
								? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)'
								: 'bg-transparent hover:bg-(--vscode-list-hoverBackground)',
						)}
						onClick={() => onOpenObject(object)}
						onContextMenu={event => onOpenContextMenu(object, event)}
					>
						<i
							className={cn('codicon', object.type === 'table' ? 'codicon-table' : 'codicon-eye')}
							aria-hidden="true"
						/>
						<span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
							{object.name}
						</span>
					</button>
				))}
				{objects.length === 0 && (
					<div className="px-3 py-2 text-xs text-(--vscode-descriptionForeground)">
						No tables or views
					</div>
				)}
			</div>
		</aside>
	);
}
