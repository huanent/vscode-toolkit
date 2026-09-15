import { cn } from 'cn';
import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';

export function List({ className, ...props }: ComponentPropsWithoutRef<'ul'>) {
	return <ul className={cn('m-0 flex min-h-0 list-none flex-col p-0', className)} {...props} />;
}

type ListGroupProps = {
	label: string;
	children: ReactNode;
	options?: boolean;
};

export function ListGroup({ label, children, options = false }: ListGroupProps) {
	const labelId = useId();
	return (
		<li role={options ? 'presentation' : undefined}>
			<div
				id={labelId}
				className="py-1 text-xs font-medium wrap-anywhere text-(--vscode-descriptionForeground)"
			>
				{label}
			</div>
			<List role={options ? 'group' : undefined} aria-labelledby={labelId}>
				{children}
			</List>
		</li>
	);
}

type ListItemProps = {
	children: ReactNode;
	icon?: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	selected?: boolean;
	role?: 'button' | 'option';
	onSelect?(): void;
	onContextMenu?: ComponentPropsWithoutRef<'li'>['onContextMenu'];
	onKeyDown?: ComponentPropsWithoutRef<'li'>['onKeyDown'];
};

export function ListItem({
	children,
	icon,
	description,
	actions,
	selected = false,
	role = 'button',
	onSelect,
	onContextMenu,
	onKeyDown,
}: ListItemProps) {
	const isOption = role === 'option';

	return (
		<li
			onContextMenu={onContextMenu}
			onKeyDown={onKeyDown}
			role={isOption ? 'presentation' : undefined}
			className={cn(
				'group flex items-center rounded-sm p-1',
				selected
					? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground,var(--vscode-foreground))'
					: 'hover:bg-(--vscode-list-hoverBackground)',
			)}
		>
			<div
				className={cn('flex min-h-4 min-w-0 flex-1 items-center gap-1 rounded-sm text-sm font-normal focus-visible:outline-1 focus-visible:outline-(--vscode-focusBorder) cursor-default')}
				role={onSelect || isOption ? role : undefined}
				tabIndex={0}
				aria-selected={isOption ? selected : undefined}
				aria-current={!isOption && selected ? 'true' : undefined}
				onClick={onSelect}
				onKeyDown={event => {
					if (!onSelect || (event.key !== 'Enter' && event.key !== ' ')) return;
					event.preventDefault();
					if (!event.repeat) onSelect();
				}}
			>
				{icon && (
					<div className="inline-flex shrink-0 p-1" aria-hidden="true">
						{icon}
					</div>
				)}
				<div className="min-w-0 flex items-baseline gap-2">
					<span className="max-w-full shrink-0 truncate">{children}</span>
					{description && (
						<small
							className={cn(
								'text-xs truncate',
								selected ? 'text-inherit' : 'text-(--vscode-descriptionForeground)',
							)}
						>
							{description}
						</small>
					)}
				</div>
			</div>
			{actions && (
				<div className="inline-flex shrink-0 items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
					{actions}
				</div>
			)}
		</li>
	);
}
