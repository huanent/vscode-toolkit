import { cn } from 'cn';
import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';

export function List({ className, ...props }: ComponentPropsWithoutRef<'ul'>) {
	return <ul className={cn('m-0 min-h-0 list-none p-0', className)} {...props} />;
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
				className="px-2 pt-3 pb-2 text-xs font-medium wrap-anywhere text-(--vscode-descriptionForeground)"
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
	truncate?: boolean;
	onSelect(): void;
};

export function ListItem({
	children,
	icon,
	description,
	actions,
	selected = false,
	role = 'button',
	truncate = false,
	onSelect,
}: ListItemProps) {
	const isOption = role === 'option';

	return (
		<li
			role={isOption ? 'presentation' : undefined}
			className={cn(
				'group flex items-center rounded-sm p-2',
				selected
					? 'bg-(--vscode-list-inactiveSelectionBackground) text-(--vscode-list-inactiveSelectionForeground,var(--vscode-foreground))'
					: 'hover:bg-(--vscode-list-hoverBackground)',
			)}
		>
			<div
				className="flex min-h-4 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm text-sm font-normal focus-visible:outline-1 focus-visible:outline-(--vscode-focusBorder)"
				role={role}
				tabIndex={0}
				aria-selected={isOption ? selected : undefined}
				aria-current={!isOption && selected ? 'true' : undefined}
				onClick={onSelect}
				onKeyDown={event => {
					if (event.key !== 'Enter' && event.key !== ' ') return;
					event.preventDefault();
					if (!event.repeat) onSelect();
				}}
			>
				{icon && (
					<div className="inline-flex shrink-0" aria-hidden="true">
						{icon}
					</div>
				)}
				<div className="grid min-w-0 gap-1">
					<span className={truncate ? 'truncate' : 'wrap-anywhere'}>{children}</span>
					{description && (
						<small className="text-xs wrap-anywhere text-(--vscode-descriptionForeground)">
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
