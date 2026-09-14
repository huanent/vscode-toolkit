import { cn } from 'cn';
import { useEffect, useState } from 'react';
import { IconButton } from '../../../../components/ui/button';
import { ArrowUp, FolderPlus, RefreshCw, Star, Upload } from '../../../../components/ui/icons';
import { Input } from '../../../../components/ui/input';
import { Favorites } from './favorites';

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
	const [anchorElement, setAnchorElement] = useState<HTMLDivElement | null>(null);

	useEffect(() => setPathValue(sftpPath), [sftpPath]);

	const favorite = favorites.includes(sftpPath);

	return (
		<header className="flex min-w-0 items-center gap-1 border-b border-(--vscode-panel-border,var(--vscode-widget-border)) p-2">
			<IconButton
				disabled={!parentPath || loading}
				label="Parent directory"
				onClick={() => parentPath && list(parentPath)}
				icon={<ArrowUp size="md" />}
			/>
			<IconButton
				disabled={loading}
				label="Refresh"
				onClick={() => list(sftpPath)}
				icon={<RefreshCw className={cn(loading ? 'codicon-modifier-spin' : '')} size="md" />}
			/>
			<div ref={setAnchorElement} className="min-w-0 flex-1">
				<Input
					aria-label="Remote path"
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
					right={
						<IconButton
							size="sm"
							className={favorite ? 'text-(--vscode-charts-yellow)' : undefined}
							label={favorite ? 'Remove from favorites' : 'Add to favorites'}
							aria-pressed={favorite}
							onClick={() => toggleFavorite()}
							icon={<Star size="xs" fill={favorite ? 'currentColor' : 'none'} />}
						/>
					}
				/>
				{favorites.length > 0 && (
					<Favorites
						open={showFavorites && !loading}
						onOpenChange={setShowFavorites}
						anchorElement={anchorElement}
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
				disabled={loading}
				label="New folder"
				onClick={() => createDirectory()}
				icon={<FolderPlus size="md" />}
			/>
			<IconButton
				disabled={loading}
				label="Upload files"
				onClick={() => upload()}
				icon={<Upload size="md" />}
			/>
		</header>
	);
}
