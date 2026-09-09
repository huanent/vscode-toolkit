import { cn } from 'cn';
import { File, Folder } from '../../../components/icons';
import type { SftpEntry } from './types';

export const fileGridClassName =
	'grid grid-cols-[minmax(140px,1fr)_72px_112px] items-center max-[760px]:grid-cols-[minmax(130px,1fr)_68px]';

interface SftpFileRowProps {
	entry: SftpEntry;
	active: boolean;
	onSelect: () => void;
	onOpen: () => void;
	onContextMenu: (x: number, y: number) => void;
}

export function SftpFileRow({ entry, active, onSelect, onOpen, onContextMenu }: SftpFileRowProps) {
	return (
		<div
			className={cn(
				fileGridClassName,
				'min-h-8 border-l-2 px-2 hover:bg-(--vscode-list-hoverBackground)',
				active
					? 'border-l-(--vscode-focusBorder) bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)'
					: 'border-l-transparent',
			)}
			role="option"
			aria-selected={active}
			tabIndex={0}
			title={entry.path}
			onClick={onSelect}
			onDoubleClick={onOpen}
			onKeyDown={event => {
				if (event.key === 'Enter') onOpen();
			}}
			onContextMenu={event => {
				event.preventDefault();
				event.stopPropagation();
				onContextMenu(event.clientX, event.clientY);
			}}
		>
			<span className="flex min-w-0 items-center gap-2">
				{entry.isDirectory ? (
					<Folder
						className="shrink-0 text-(--vscode-symbolIcon-folderForeground,var(--vscode-icon-foreground))"
						size={15}
					/>
				) : (
					<File
						className="shrink-0 text-(--vscode-symbolIcon-fileForeground,var(--vscode-icon-foreground))"
						size={15}
					/>
				)}
				<span className="overflow-hidden text-[11px] text-ellipsis whitespace-nowrap">
					{entry.name}
				</span>
			</span>
			<span className="overflow-hidden text-right font-(family-name:--vscode-editor-font-family) text-[10px] text-ellipsis whitespace-nowrap text-(--vscode-descriptionForeground)">
				{entry.isDirectory ? '-' : formatFileSize(entry.size)}
			</span>
			<span className="overflow-hidden text-right text-[10px] text-ellipsis whitespace-nowrap text-(--vscode-descriptionForeground) max-[760px]:hidden">
				{formatModifiedAt(entry.modifiedAt)}
			</span>
		</div>
	);
}

function formatFileSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unit = units[0];
	for (let index = 1; index < units.length && value >= 1024; index++) {
		value /= 1024;
		unit = units[index];
	}
	return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

function formatModifiedAt(timestamp: number) {
	const date = new Date(timestamp);
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
