import { cn } from 'cn';
import { useEffect, useState } from 'react';
import { IconButton } from '../components/button';
import { ArrowUp, FolderPlus, RefreshCw, Star, Upload, X } from '../components/icons';
import { TextInput } from '../components/input';

interface SftpToolbarProps {
	sftpPath: string;
	parentPath: string | null;
	favorites: string[];
	loading: boolean;
	list: (path: string) => void;
	toggleFavorite: (path?: string) => void;
	createDirectory: (path?: string) => void;
	upload: (path?: string) => void;
}

const popupClassName =
	'rounded-[4px] border border-(--vscode-menu-border,var(--vscode-widget-border,var(--vscode-panel-border))) bg-(--vscode-menu-background) p-1 text-(--vscode-menu-foreground) shadow-[0_4px_14px_var(--vscode-widget-shadow)]';

export function SftpToolbar({
	sftpPath,
	parentPath,
	favorites,
	loading,
	list,
	toggleFavorite,
	createDirectory,
	upload,
}: SftpToolbarProps) {
	const [pathValue, setPathValue] = useState(sftpPath);
	const [showFavorites, setShowFavorites] = useState(false);

	useEffect(() => setPathValue(sftpPath), [sftpPath]);
	useEffect(() => {
		const closeFavorites = () => setShowFavorites(false);
		window.addEventListener('blur', closeFavorites);
		window.addEventListener('click', closeFavorites);
		return () => {
			window.removeEventListener('blur', closeFavorites);
			window.removeEventListener('click', closeFavorites);
		};
	}, []);

	const favorite = favorites.includes(sftpPath);

	return (
		<header className="flex min-w-0 items-center gap-1 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) p-1">
			<IconButton
				className="size-7 border-0"
				disabled={!parentPath || loading}
				title="Parent directory"
				onClick={() => parentPath && list(parentPath)}
			>
				<ArrowUp size={15} />
			</IconButton>
			<IconButton
				className="size-7 border-0"
				disabled={loading}
				title="Refresh"
				onClick={() => list(sftpPath)}
			>
				<RefreshCw className={cn(loading ? 'codicon-modifier-spin' : '')} size={15} />
			</IconButton>
			<div
				className="relative flex min-w-0 flex-1 items-center overflow-visible rounded-[3px] border border-(--vscode-input-border,var(--vscode-widget-border,var(--vscode-panel-border))) bg-(--vscode-input-background) focus-within:border-(--vscode-focusBorder) focus-within:shadow-[0_0_0_1px_var(--vscode-focusBorder)]"
				onClick={event => event.stopPropagation()}
				onBlur={event => {
					if (!event.currentTarget.contains(event.relatedTarget)) setShowFavorites(false);
				}}
			>
				<TextInput
					aria-label="Remote path"
					className="min-w-0 border-0 bg-transparent px-2 font-(family-name:--vscode-editor-font-family) text-xs shadow-none focus:border-transparent"
					disabled={loading}
					spellCheck={false}
					value={pathValue}
					onFocus={() => setShowFavorites(true)}
					onChange={event => setPathValue(event.target.value)}
					onKeyDown={event => {
						if (event.key === 'Enter' && pathValue.trim()) {
							list(pathValue.trim());
							setShowFavorites(false);
						}
						if (event.key === 'Escape') {
							setPathValue(sftpPath);
							setShowFavorites(false);
						}
					}}
				/>
				<IconButton
					className={cn(
						'size-5 border-0',
						favorite ? 'text-(--vscode-charts-yellow)' : 'text-(--vscode-descriptionForeground)',
					)}
					title={favorite ? 'Remove from favorites' : 'Add to favorites'}
					onClick={event => {
						event.stopPropagation();
						toggleFavorite();
					}}
				>
					<Star size={12} fill={favorite ? 'currentColor' : 'none'} />
				</IconButton>
				{showFavorites && favorites.length > 0 && (
					<Favorites
						paths={favorites}
						activePath={sftpPath}
						onSelect={path => {
							list(path);
							setShowFavorites(false);
						}}
						onRemove={path => toggleFavorite(path)}
					/>
				)}
			</div>
			<IconButton
				className="size-7 border-0"
				disabled={loading}
				title="New folder"
				onClick={() => createDirectory()}
			>
				<FolderPlus size={15} />
			</IconButton>
			<IconButton
				className="size-7 border-0"
				disabled={loading}
				title="Upload files"
				onClick={() => upload()}
			>
				<Upload size={15} />
			</IconButton>
		</header>
	);
}

function Favorites({
	paths,
	activePath,
	onSelect,
	onRemove,
}: {
	paths: string[];
	activePath: string;
	onSelect: (path: string) => void;
	onRemove: (path: string) => void;
}) {
	return (
		<div
			className={cn(
				popupClassName,
				'absolute top-[calc(100%+5px)] right-0 left-0 z-20 max-h-56 min-w-52 overflow-auto',
			)}
			role="listbox"
		>
			{paths.map(path => (
				<div
					key={path}
					className={cn(
						'group flex min-h-7 items-center rounded-[3px] hover:bg-(--vscode-list-hoverBackground) focus-within:bg-(--vscode-list-hoverBackground)',
						path === activePath ? 'text-(--vscode-textLink-foreground)' : '',
					)}
					role="option"
					aria-selected={path === activePath}
				>
					<button
						className="min-w-0 flex-1 overflow-hidden border-0 bg-transparent px-2 text-left font-(family-name:--vscode-editor-font-family) text-[11px] text-ellipsis whitespace-nowrap outline-none"
						title={path}
						onClick={() => onSelect(path)}
					>
						{path}
					</button>
					<button
						className="mr-1 grid size-5 shrink-0 place-items-center rounded-xs border-0 bg-transparent text-(--vscode-icon-foreground) opacity-0 outline-none hover:bg-(--vscode-toolbar-hoverBackground) focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
						title="Remove from favorites"
						aria-label={`Remove ${path} from favorites`}
						onClick={event => {
							event.stopPropagation();
							onRemove(path);
						}}
					>
						<X size={12} />
					</button>
				</div>
			))}
		</div>
	);
}
