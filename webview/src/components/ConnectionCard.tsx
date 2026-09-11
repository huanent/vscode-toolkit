import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from 'cn';
import {
	ArrowUp,
	ArrowDown,
	Copy,
	Download,
	Pencil,
	Play,
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
	primaryActionLabel = 'Open',
	selected,
	onSelect,
	onAction,
	actions: customActions,
}: {
	server: Connection;
	filtered?: boolean;
	compact?: boolean;
	disabled?: boolean;
	primaryActionLabel?: string;
	selected: boolean;
	onSelect: (id: string) => void;
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
				'group/item relative flex min-w-0 items-center focus-within:outline focus-within:outline-(--vscode-focusBorder)',
				selected
					? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)'
					: 'hover:bg-(--vscode-list-hoverBackground)',
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
				className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xs bg-transparent px-2 text-left disabled:opacity-45"
				title={`${server.name}\n${server.address}`}
				aria-label={`Select ${server.name}`}
				aria-pressed={selected}
				onClick={() => onSelect(server.id)}
			>
				<span className="min-w-0 max-w-[60%] shrink-0 truncate text-sm font-medium">{server.name}</span>
				<span className={cn('min-w-0 flex-1 truncate text-xs', !selected && 'text-(--vscode-descriptionForeground)')}>
					{server.address}
				</span>
			</button>
			<IconButton
				type="button"
				className="pointer-events-none mr-1 size-7 shrink-0 rounded-xs opacity-0 group-hover/item:pointer-events-auto group-hover/item:opacity-100 group-focus-within/item:pointer-events-auto group-focus-within/item:opacity-100 focus-visible:outline focus-visible:outline-(--vscode-focusBorder)"
				title={`${primaryActionLabel} ${server.name}`}
				aria-label={`${primaryActionLabel} ${server.name}`}
				disabled={disabled}
				onClick={() => {
					setPosition(undefined);
					onSelect(server.id);
					onAction('connect', server.id);
				}}
			>
				<Play size={16} />
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
