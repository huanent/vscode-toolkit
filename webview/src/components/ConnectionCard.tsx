import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from 'cn';
import {
	ArrowUp,
	ArrowDown,
	Copy,
	Download,
	Pencil,
	MoreHorizontal,
	Trash2,
	type IconComponent,
} from './icons';
import { IconButton } from './button';

export interface Connection {
	id: string;
	name: string;
	group: string;
	address: string;
	kind: string;
}

export interface ItemAction {
	type: string;
	label: string;
	icon: IconComponent;
	disabled?: boolean;
}
export function ConnectionCard({
	server,
	filtered = false,
	compact = false,
	disabled = false,
	onAction,
	actions: customActions,
}: {
	server: Connection;
	filtered?: boolean;
	compact?: boolean;
	disabled?: boolean;
	onAction: (type: string, id: string) => void;
	actions?: ItemAction[];
}) {
	const [position, setPosition] = useState<{ left: number; top: number }>();
	const open = position !== undefined;
	const container = useRef<HTMLLIElement>(null);
	const menu = useRef<HTMLDivElement>(null);
	const focusTrigger = () => container.current?.querySelector<HTMLButtonElement>('button')?.focus();
	useLayoutEffect(() => {
		if (!position || !menu.current) return;
		const bounds = menu.current.getBoundingClientRect();
		const left = Math.max(4, Math.min(position.left, window.innerWidth - bounds.width - 4));
		const top = Math.max(4, Math.min(position.top, window.innerHeight - bounds.height - 4));
		if (left !== position.left || top !== position.top) setPosition({ left, top });
		menu.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
	}, [position]);
	useEffect(() => {
		if (!open) return;
		const dismiss = (event: PointerEvent) => {
			if (!container.current?.contains(event.target as Node)) setPosition(undefined);
		};
		const close = () => setPosition(undefined);
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setPosition(undefined);
				focusTrigger();
			}
		};
		document.addEventListener('pointerdown', dismiss);
		document.addEventListener('keydown', escape);
		window.addEventListener('resize', close);
		window.addEventListener('scroll', close);
		return () => {
			document.removeEventListener('pointerdown', dismiss);
			document.removeEventListener('keydown', escape);
			window.removeEventListener('resize', close);
			window.removeEventListener('scroll', close);
		};
	}, [open]);
	const actions = customActions ?? [
		{ type: 'edit', label: 'Edit', icon: Pencil },
		{ type: 'duplicate', label: 'Duplicate', icon: Copy },
		...(server.kind === 'SSH' || server.kind === 'MySQL'
			? [{ type: 'copyHost', label: 'Copy Host', icon: Copy }]
			: []),
		{ type: 'up', label: 'Move Up', icon: ArrowUp, disabled: filtered },
		{ type: 'down', label: 'Move Down', icon: ArrowDown, disabled: filtered },
		{ type: 'export', label: 'Export', icon: Download },
		{ type: 'delete', label: 'Delete', icon: Trash2 },
	];
	return (
		<li
			ref={container}
			className={cn(
				'relative flex min-w-0 items-center hover:bg-(--vscode-list-hoverBackground) focus-within:outline focus-within:outline-(--vscode-focusBorder)',
				compact ? 'rounded-xs' : 'rounded-sm border border-(--vscode-panel-border)',
			)}
			onBlur={event => {
				if (!event.currentTarget.contains(event.relatedTarget)) setPosition(undefined);
			}}
			onContextMenu={event => {
				event.preventDefault();
				setPosition({ left: event.clientX, top: event.clientY });
			}}
			onKeyDown={event => {
				if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
					event.preventDefault();
					const bounds = event.currentTarget.getBoundingClientRect();
					setPosition({ left: bounds.left, top: bounds.bottom });
				}
			}}
		>
			<button
				type="button"
				disabled={disabled}
				className={cn(
					'flex min-w-0 flex-1 flex-col gap-1 rounded-xs bg-transparent text-left disabled:opacity-45',
					compact ? 'px-2 py-2' : 'p-2',
				)}
				title={`Open ${server.name}\n${server.address}`}
				aria-label={`Open ${server.name}`}
				onClick={() => onAction('connect', server.id)}
			>
				<span className="w-full truncate text-sm font-medium">{server.name}</span>
				<span className="w-full truncate text-xs text-(--vscode-descriptionForeground)">
					{server.address}
				</span>
			</button>
			<IconButton
				type="button"
				className="mr-1 size-7 rounded-xs focus-visible:outline focus-visible:outline-(--vscode-focusBorder)"
				title={`Actions for ${server.name}`}
				aria-label={`Actions for ${server.name}`}
				aria-expanded={open}
				aria-controls={open ? `actions-${server.id}` : undefined}
				onClick={event => {
					const bounds = event.currentTarget.getBoundingClientRect();
					setPosition(open ? undefined : { left: bounds.right - 176, top: bounds.bottom });
				}}
			>
				<MoreHorizontal size={16} />
			</IconButton>
			{open && (
				<div
					ref={menu}
					id={`actions-${server.id}`}
					role="group"
					aria-label={`Actions for ${server.name}`}
					style={position}
					className="fixed z-50 max-h-[calc(100vh-8px)] w-44 overflow-y-auto rounded-sm border border-(--vscode-menu-border,var(--vscode-panel-border)) bg-(--vscode-menu-background,var(--vscode-editor-background)) p-1 text-(--vscode-menu-foreground,var(--vscode-foreground)) shadow-sm"
				>
					{actions.map(({ type, label, icon: Icon, disabled }) => (
						<button
							key={type}
							type="button"
							disabled={disabled}
							className="flex w-full items-center gap-2 rounded-xs px-2 py-1.5 text-left text-xs hover:bg-(--vscode-menu-selectionBackground) hover:text-(--vscode-menu-selectionForeground) disabled:opacity-40"
							onClick={() => {
								setPosition(undefined);
								focusTrigger();
								onAction(type, server.id);
							}}
						>
							<Icon size={14} />
							<span>{label}</span>
						</button>
					))}
				</div>
			)}
		</li>
	);
}
