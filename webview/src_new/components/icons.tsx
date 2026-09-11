import type { ComponentType, HTMLAttributes } from 'react';
import { Codicon } from '../../src/components/codicon';

const iconSizes = {
	xs: 12,
	sm: 14,
	md: 16,
	lg: 20,
	xl: 24,
	'2xl': 32,
} as const;

export type IconSize = keyof typeof iconSizes;

export type IconProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
	size?: IconSize;
	fill?: string;
};

export type IconComponent = ComponentType<IconProps>;

function icon(name: string) {
	return function Icon({ size = 'md', fill: _fill, ...props }: IconProps) {
		return <Codicon name={name} size={iconSizes[size]} {...props} />;
	};
}

export const ArrowDown = icon('arrow-down');
export const ArrowLeft = icon('arrow-left');
export const ArrowUp = icon('arrow-up');
export const Boxes = icon('vm');
export const ChevronDown = icon('chevron-down');
export const ChevronLeft = icon('chevron-left');
export const ChevronRight = icon('chevron-right');
export const ChevronsUpDown = icon('arrow-swap');
export const CircleAlert = icon('warning');
export const CircleCheck = icon('check');
export const CircleSlash = icon('circle-slash');
export const CircuitBoard = icon('circuit-board');
export const Container = icon('symbol-method');
export const Copy = icon('copy');
export const Database = icon('database');
export const Download = icon('cloud-download');
export const DownloadToDevice = icon('download');
export const Edit3 = icon('edit');
export const Eye = icon('eye');
export const EyeOff = icon('eye-closed');
export const File = icon('file');
export const FileArchive = icon('file-zip');
export const FileCode = icon('file-code');
export const FileImage = icon('file-media');
export const FileJson = icon('json');
export const FileText = icon('file-text');
export const Folder = icon('folder');
export const FolderOpen = icon('folder-opened');
export const FolderPlus = icon('new-folder');
export const Gist = icon('gist');
export const Globe = icon('globe');
export const Grid2X2 = icon('layout');
export const History = icon('history');
export const Home = icon('home');
export const Info = icon('info');
export const KeyRound = icon('key');
export const List = icon('list-flat');
export const ListOrdered = icon('list-ordered');
export const LoaderCircle = icon('loading');
export const Markdown = icon('markdown');
export const Menu = icon('menu');
export const MessageCircle = icon('comment');
export const MessageSquare = icon('comment-discussion');
export const Monitor = icon('device-desktop');
export const MoreHorizontal = icon('ellipsis');
export const Network = icon('globe');
export const Package = icon('package');
export const Pencil = icon('edit');
export const Play = icon('play');
export const Plus = icon('add');
export const RefreshCw = icon('refresh');
export const RotateCw = icon('sync');
export const Rocket = icon('rocket');
export const Save = icon('save');
export const Search = icon('search');
export const Send = icon('send');
export const Server = icon('server');
export const Sparkles = icon('sparkle');
export const Square = icon('debug-stop');
export const StarEmpty = icon('star-empty');
export const StarFull = icon('star-full');
export const Table = icon('table');
export const Terminal = icon('terminal');
export const Trash2 = icon('trash');
export const Upload = icon('cloud-upload');
export const X = icon('close');

export function Star({ size = 'md', fill, ...props }: IconProps) {
	return (
		<Codicon
			name={fill === 'currentColor' ? 'star-full' : 'star-empty'}
			size={iconSizes[size]}
			{...props}
		/>
	);
}