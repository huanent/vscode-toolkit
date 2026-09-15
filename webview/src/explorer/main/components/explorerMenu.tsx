import { useState } from 'react';
import { Popover } from '@webview/components/ui/popover';
import { Button, IconButton } from '@webview/components/ui/button';
import { Menu } from '@webview/components/ui/icons';
import type { ExplorerModel } from '../hooks/useExplorer';

type ExplorerMenuProps = Pick<ExplorerModel, 'state' | 'actions'>;

export function ExplorerMenu({ state, actions }: ExplorerMenuProps) {
	const [open, setOpen] = useState(false);
	const hasPendingFolderSizes = state.entries.some(
		entry => entry.type === 'directory' && entry.calculatedSize === undefined && !entry.calculating,
	);

	return (
		<Popover open={open} onOpenChange={setOpen} label="View options" placement="bottom-end"
			trigger={props => <IconButton {...props} icon={<Menu />} label="View options" />}>
			<div className="p-1">
				<Button variant="text" size="sm"
					disabled={!hasPendingFolderSizes}
					onClick={() => {
						actions.calculateAllFolderSizes();
						setOpen(false);
					}}
				>Calculate All Folder Sizes</Button>
			</div>
		</Popover>
	);
}
