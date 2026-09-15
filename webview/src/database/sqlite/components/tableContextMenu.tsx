import { Button } from '../../../components/ui/button';
import { Popover } from '../../../components/ui/popover';
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
	const disabled = object.type !== 'table' || object.name.startsWith('sqlite_');
	return (
		<Popover
			open
			label="Table actions"
			anchorPosition={{ x, y }}
			onOpenChange={open => {
				if (!open) onClose();
			}}
		>
			<div className="grid min-w-40 gap-1 p-1">
				<Button
					variant="text"
					size="sm"
					disabled={disabled}
					onClick={() => {
						onNewRow(object);
						onClose();
					}}
				>
					New data
				</Button>
				<Button
					variant="text"
					size="sm"
					disabled={disabled}
					onClick={() => {
						onEditTable(object);
						onClose();
					}}
				>
					Edit table
				</Button>
				<Button
					variant="text"
					size="sm"
					disabled={disabled}
					onClick={() => {
						onDeleteTable(object);
						onClose();
					}}
				>
					Delete table
				</Button>
			</div>
		</Popover>
	);
}
