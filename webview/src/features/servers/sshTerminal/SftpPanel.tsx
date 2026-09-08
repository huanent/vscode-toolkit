import { cn } from 'cn';
import { useEffect, useState } from 'react';
import { FolderOpen, LoaderCircle } from '../components/icons';
import { fileGridClassName, SftpFileRow } from './SftpFileRow';
import { SftpToolbar } from './SftpToolbar';
import type { SftpEntry } from './types';

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

const popupClassName =
	'rounded-[4px] border border-(--vscode-menu-border,var(--vscode-widget-border,var(--vscode-panel-border))) bg-(--vscode-menu-background) p-1 text-(--vscode-menu-foreground) shadow-[0_4px_14px_var(--vscode-widget-shadow)]';

export function SftpPanel({ sftp }: { sftp: SftpActions }) {
	const [menu, setMenu] = useState<ContextMenuState>();
	const [selectedPath, setSelectedPath] = useState<string>();

	useEffect(() => setSelectedPath(undefined), [sftp.sftpPath]);
	useEffect(() => {
		const closeMenu = () => setMenu(undefined);
		window.addEventListener('blur', closeMenu);
		window.addEventListener('click', closeMenu);
		return () => {
			window.removeEventListener('blur', closeMenu);
			window.removeEventListener('click', closeMenu);
		};
	}, []);

	return (
		<aside
			className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] border-l border-(--vscode-panel-border,var(--vscode-widget-border)) bg-(--vscode-editor-background) select-none"
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
					'border-b border-(--vscode-panel-border,var(--vscode-widget-border)) p-2 text-xs font-semibold text-(--vscode-descriptionForeground)',
				)}
			>
				<span>Name</span>
				<span className="text-right">Size</span>
				<span className="text-right max-[760px]:hidden">Modified</span>
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
					<Status
						icon={<LoaderCircle className="codicon-modifier-spin" size={18} />}
						title="Loading directory"
						detail={sftp.sftpPath}
					/>
				) : (
					sftp.entries.length === 0 && (
						<Status
							icon={<FolderOpen size={20} />}
							title="This folder is empty"
							detail="Upload a file or create a new folder."
						/>
					)
				)}
			</div>

			{menu && (
				<Menu
					className="fixed"
					style={{
						left: Math.max(4, Math.min(menu.x, window.innerWidth - 190)),
						top: Math.max(4, Math.min(menu.y, window.innerHeight - 210)),
					}}
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
	className,
	style,
	onDismiss,
}: {
	items: { label: string; danger?: boolean; action: () => void }[];
	className: string;
	style?: React.CSSProperties;
	onDismiss: () => void;
}) {
	return (
		<div
			className={cn(popupClassName, 'z-30 min-w-44', className)}
			style={style}
			tabIndex={-1}
			autoFocus
			role="menu"
			onKeyDown={event => {
				if (event.key === 'Escape') {
					event.stopPropagation();
					onDismiss();
				}
			}}
			onBlur={event => {
				if (!event.currentTarget.contains(event.relatedTarget)) onDismiss();
			}}
		>
			{items.map(item => (
				<button
					key={item.label}
					className={cn(
						'block min-h-7.5 w-full rounded-[3px] border-0 bg-transparent px-2.5 text-left text-xs outline-none hover:bg-(--vscode-menu-selectionBackground) hover:text-(--vscode-menu-selectionForeground) focus:bg-(--vscode-menu-selectionBackground) focus:text-(--vscode-menu-selectionForeground)',
						item.danger
							? 'text-(--vscode-errorForeground) hover:text-(--vscode-errorForeground)! focus:text-(--vscode-errorForeground)!'
							: '',
					)}
					role="menuitem"
					onClick={event => {
						event.stopPropagation();
						item.action();
						onDismiss();
					}}
				>
					{item.label}
				</button>
			))}
		</div>
	);
}

function Status({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
	return (
		<div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[color-mix(in_srgb,var(--vscode-editor-background)_90%,transparent)] p-6 text-center text-(--vscode-descriptionForeground)">
			<span className="text-(--vscode-icon-foreground)">{icon}</span>
			<strong className="text-[11px] font-semibold text-(--vscode-foreground)">{title}</strong>
			<span className="max-w-60 overflow-hidden text-[10px] text-ellipsis whitespace-nowrap">
				{detail}
			</span>
		</div>
	);
}
