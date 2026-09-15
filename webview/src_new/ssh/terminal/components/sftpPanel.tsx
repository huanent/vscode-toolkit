import { cn } from 'cn';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import { Popover } from '../../../components/ui/popover';
import { FolderOpen, LoaderCircle } from '../../../components/ui/icons';
import { fileGridClassName, SftpFileRow } from './sftpFileRow';
import { SftpToolbar } from './sftpToolbar';
import type { SftpEntry } from '../types';

interface SftpActions {
	sftpPath: string;
	parentPath: string | null;
	entries: SftpEntry[];
	favorites: string[];
	loading: boolean;
	list: (path: string) => void;
	toggleFavorite: (path?: string) => void;
	createDirectory: (path?: string) => void;
	upload: (path?: string) => void;
	rename: (path: string) => void;
	download: (entry: SftpEntry) => void;
	deleteEntry: (entry: SftpEntry) => void;
	copyPath: (path: string) => void;
	edit: (path: string) => void;
}

interface ContextMenuState {
	entry: SftpEntry;
	x: number;
	y: number;
}

export function SftpPanel({ sftp }: { sftp: SftpActions }) {
	const [menu, setMenu] = useState<ContextMenuState>();
	const [selectedPath, setSelectedPath] = useState<string>();

	useEffect(() => setSelectedPath(undefined), [sftp.sftpPath]);

	return (
		<aside
			className="@container grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] border-l border-(--vscode-panel-border,var(--vscode-widget-border)) bg-(--vscode-editor-background) select-none max-[760px]:border-t max-[760px]:border-l-0"
			aria-label="SFTP file browser"
		>
			<SftpToolbar
				sftpPath={sftp.sftpPath}
				parentPath={sftp.parentPath}
				favorites={sftp.favorites}
				loading={sftp.loading}
				list={sftp.list}
				toggleFavorite={sftp.toggleFavorite}
				createDirectory={sftp.createDirectory}
				upload={sftp.upload}
			/>

			<div
				className={cn(
					fileGridClassName,
					'border-b border-l-2 border-l-transparent border-b-(--vscode-panel-border,var(--vscode-widget-border)) px-3 py-2 text-xs font-medium text-(--vscode-descriptionForeground)',
				)}
			>
				<span>Name</span>
				<span className="text-right">Size</span>
				<span className="text-right">Modified</span>
			</div>

			<div className="relative min-h-0 overflow-hidden">
				<div
					className="h-full overflow-auto"
					role="listbox"
					aria-label={`Files in ${sftp.sftpPath}`}
				>
					{sftp.entries.map(entry => (
						<SftpFileRow
							key={entry.path}
							entry={entry}
							active={selectedPath === entry.path || menu?.entry.path === entry.path}
							onSelect={() => setSelectedPath(entry.path)}
							onOpen={() => (entry.isDirectory ? sftp.list(entry.path) : sftp.edit(entry.path))}
							onContextMenu={(x, y) => {
								setSelectedPath(entry.path);
								setMenu({ entry, x, y });
							}}
						/>
					))}
				</div>
				{sftp.loading ? (
					<Empty
						className="absolute inset-0 overflow-auto bg-(--vscode-editor-background)"
						role="status"
						icon={<LoaderCircle className="codicon-modifier-spin" size="md" />}
						title="Loading directory"
						description={sftp.sftpPath}
					/>
				) : (
					sftp.entries.length === 0 && (
						<Empty
							className="absolute inset-0 overflow-auto bg-(--vscode-editor-background)"
							icon={<FolderOpen size="lg" />}
							title="This folder is empty"
						/>
					)
				)}
			</div>

			{menu && (
				<Menu
					position={menu}
					onDismiss={() => setMenu(undefined)}
					items={[
						...(menu.entry.isDirectory
							? [
								{ label: 'New Folder', action: () => sftp.createDirectory(menu.entry.path) },
								{ label: 'Upload Files', action: () => sftp.upload(menu.entry.path) },
							]
							: [{ label: 'Edit Text', action: () => sftp.edit(menu.entry.path) }]),
						{ label: 'Download', action: () => sftp.download(menu.entry) },
						{ label: 'Copy Path', action: () => sftp.copyPath(menu.entry.path) },
						{ label: 'Rename', action: () => sftp.rename(menu.entry.path) },
						{ label: 'Delete', danger: true, action: () => sftp.deleteEntry(menu.entry) },
					]}
				/>
			)}
		</aside>
	);
}

function Menu({
	items,
	position,
	onDismiss,
}: {
	items: { label: string; danger?: boolean; action: () => void }[];
	position: { x: number; y: number };
	onDismiss: () => void;
}) {
	return (
		<Popover
			open
			label="File actions"
			anchorPosition={position}
			className="grid min-w-44 p-1"
			onOpenChange={open => {
				if (!open) onDismiss();
			}}
		>
			{items.map(item => (
				<Button
					key={item.label}
					variant="text"
					className={cn('justify-start', item.danger && 'text-(--vscode-errorForeground)')}
					onClick={event => {
						event.stopPropagation();
						item.action();
						onDismiss();
					}}
				>
					{item.label}
				</Button>
			))}
		</Popover>
	);
}
