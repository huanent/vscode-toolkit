import { cn } from 'cn';
import type { HTMLAttributes } from 'react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
export type IconVariant = 'default' | 'muted';

export type IconProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
	name: string;
	size?: IconSize;
	variant?: IconVariant;
	className?: string;
};

const sizeClasses: Record<IconSize, string> = {
	xs: '!text-[12px]',
	sm: '!text-[12px]',
	md: '!text-[16px]',
	lg: '!text-[20px]',
	xl: '!text-[24px]',
	'2xl': '!text-[32px]',
	'3xl': '!text-[40px]',
};

const variantClasses: Record<IconVariant, string> = {
	default: '',
	muted: 'text-(--vscode-descriptionForeground)',
};

export function Icon({ name, size = 'md', variant = 'default', className, ...props }: IconProps) {
	return (
		<i
			{...props}
			className={cn(
				'codicon shrink-0 leading-none',
				`codicon-${name}`,
				sizeClasses[size],
				variantClasses[variant],
				className,
			)}
			aria-hidden="true"
		/>
	);
}

export type CodiconProps = {
	name: string;
	size?: number;
	className?: string;
} & HTMLAttributes<HTMLSpanElement>;

export function Codicon({ name, size = 16, className = '', style, ...props }: CodiconProps) {
	return (
		<span
			aria-hidden="true"
			className={cn('codicon', `codicon-${name}`, className)}
			style={{ fontSize: size, ...style }}
			{...props}
		/>
	);
}

type SizedIconProps = Pick<IconProps, 'size'>;

export function DisclosureIcon({ expanded, size = 'md' }: SizedIconProps & { expanded: boolean }) {
	return (
		<Icon
			name="chevron-right"
			size={size}
			className={cn('transition-transform', expanded && 'rotate-90')}
		/>
	);
}

export type NamedIconProps = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
	size?: IconSize;
	fill?: string;
	variant?: IconVariant;
	className?: string;
};

function createIcon(name: string) {
	return function NamedIcon({ size = 'sm', fill: _fill, ...props }: NamedIconProps) {
		return <Icon name={name} size={size} {...props} />;
	};
}

export const ArrowDown = createIcon('arrow-down');
export const ArrowLeft = createIcon('arrow-left');
export const ArrowUp = createIcon('arrow-up');
export const Boxes = createIcon('vm');
export const ChevronDown = createIcon('chevron-down');
export const ChevronLeft = createIcon('chevron-left');
export const ChevronRight = createIcon('chevron-right');
export const ChevronsUpDown = createIcon('arrow-swap');
export const CircleAlert = createIcon('warning');
export const CircleCheck = createIcon('check');
export const CircleSlash = createIcon('circle-slash');
export const CircuitBoard = createIcon('circuit-board');
export const CollapseAll = createIcon('collapse-all');
export const Container = createIcon('symbol-method');
export const Copy = createIcon('copy');
export const Database = createIcon('database');
export const Download = createIcon('cloud-download');
export const Eye = createIcon('eye');
export const EyeOff = createIcon('eye-closed');
export const File = createIcon('file');
export const FileText = createIcon('file-text');
export const Folder = createIcon('folder');
export const FolderOpen = createIcon('folder-opened');
export const FolderPlus = createIcon('new-folder');
export const Gist = createIcon('gist');
export const History = createIcon('history');
export const Home = createIcon('home');
export const Info = createIcon('info');
export const List = createIcon('list-flat');
export const LoaderCircle = createIcon('loading');
export const Menu = createIcon('menu');
export const MessageCircle = createIcon('comment');
export const MessageSquare = createIcon('comment-discussion');
export const Network = createIcon('globe');
export const Package = createIcon('package');
export const Pencil = createIcon('edit');
export const Play = createIcon('play');
export const Plus = createIcon('add');
export const RefreshCw = createIcon('refresh');
export const RotateCw = createIcon('sync');
export const Save = createIcon('save');
export const Search = createIcon('search');
export const Send = createIcon('send');
export const Server = createIcon('server');
export const Sparkles = createIcon('sparkle');
export const Square = createIcon('debug-stop');
export const Table = createIcon('table');
export const Terminal = createIcon('terminal');
export const Trash2 = createIcon('trash');
export const Upload = createIcon('cloud-upload');
export const X = createIcon('close');

export function Star({ size = 'md', fill, ...props }: NamedIconProps) {
	return (
		<Icon name={fill === 'currentColor' ? 'star-full' : 'star-empty'} size={size} {...props} />
	);
}
