import { IconButton } from '../../../components/ui/button';
import { List, ListItem } from '../../../components/ui/list';
import { Eye, Plus, Table } from '../../../components/ui/icons';
import type { MouseEvent } from 'react';
import type { DatabaseObject } from '../types';

interface DatabaseSidebarProps {
	objects: DatabaseObject[];
	selectedObject: DatabaseObject | null;
	onCreateTable: () => void;
	onOpenObject: (object: DatabaseObject) => void;
	onOpenContextMenu: (object: DatabaseObject, event: MouseEvent<HTMLLIElement>) => void;
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
			<div className="flex min-h-9 shrink-0 items-center gap-2 border-b border-(--vscode-panel-border) px-3 py-1">
				<span className="min-w-0 flex-1 text-xs font-medium wrap-anywhere text-(--vscode-descriptionForeground)">
					Tables
				</span>
				<IconButton icon={<Plus />} label="Create table" size="sm" onClick={onCreateTable} />
			</div>
			<div className="min-h-0 flex-1 overflow-auto py-1">
				<List>
					{objects.map(object => (
						<ListItem
							key={`${object.type}:${object.name}`}
							selected={selectedObject?.name === object.name}
							icon={object.type === 'table' ? <Table /> : <Eye />}
							onSelect={() => onOpenObject(object)}
							onContextMenu={event => onOpenContextMenu(object, event)}
						>
							{object.name}
						</ListItem>
					))}
				</List>
				{objects.length === 0 && (
					<div className="px-3 py-2 text-xs text-(--vscode-descriptionForeground)">
						No tables or views
					</div>
				)}
			</div>
		</aside>
	);
}
