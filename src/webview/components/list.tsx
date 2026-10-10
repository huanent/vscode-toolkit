import { cn } from 'cn';
import { useEffect, useId, useRef, useState, type ComponentPropsWithoutRef } from 'react';
import type { AriaRole, Key, KeyboardEvent, MouseEvent, ReactNode } from 'react';

export type ListItemState = {
	focused: boolean;
	selected: boolean;
	listHasFocus: boolean;
};

export type DataListItem<T> = {
	key: Key;
	data: T;
	icon?: ReactNode | ((state: ListItemState) => ReactNode);
	label: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	context?: Readonly<Record<string, string | number | boolean>>;
	expanded?: boolean;
	level?: number;
	position?: number;
	setSize?: number;
};

export type DataListGroup<T> = {
	key: Key;
	label: ReactNode;
	items: readonly DataListItem<T>[];
};

type DataListPropsBase<T> = {
	ariaLabel: string;
	selectedKey?: Key;
	role?: AriaRole;
	itemRole?: AriaRole;
	onFocusedKeyChange?: (key: Key | null) => void;
	onActivate?: (item: T) => void;
	onItemClick?: (item: T, event: MouseEvent<HTMLDivElement>) => void;
	onKeyDown?: (
		event: KeyboardEvent<HTMLDivElement>,
		item: T | undefined,
		focusItem: (item: T | undefined) => void,
	) => void;
};

export type DataListProps<T> =
	| (DataListPropsBase<T> & { items: readonly DataListItem<T>[]; groups?: never })
	| (DataListPropsBase<T> & { items?: never; groups: readonly DataListGroup<T>[] });

export type SimpleListProps = ComponentPropsWithoutRef<'ul'> & {
	items?: never;
	groups?: never;
	ariaLabel?: never;
};

export type ListProps<T = unknown> = DataListProps<T> | SimpleListProps;

function isDataListProps<T>(props: ListProps<T>): props is DataListProps<T> {
	return (
		('items' in props && props.items !== undefined) ||
		('groups' in props && props.groups !== undefined)
	);
}

export function List<T = unknown>(props: ListProps<T>) {
	if (isDataListProps(props)) {
		return <DataList {...props} />;
	}
	const { className, ariaLabel: _ariaLabel, items: _items, groups: _groups, ...ulProps } = props;
	return <ul className={cn('m-0 flex min-h-0 list-none flex-col p-0', className)} {...ulProps} />;
}

export type ListGroupProps = {
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

export type ListItemProps = {
	children: ReactNode;
	icon?: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
	selected?: boolean;
	role?: 'button' | 'option';
	onSelect?(): void;
	onContextMenu?: ComponentPropsWithoutRef<'li'>['onContextMenu'];
	onKeyDown?: ComponentPropsWithoutRef<'li'>['onKeyDown'];
	'data-vscode-context'?: string;
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
	'data-vscode-context': vscodeContext,
}: ListItemProps) {
	const isOption = role === 'option';

	return (
		<li
			data-vscode-context={vscodeContext}
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
				className={cn(
					'flex min-h-4 min-w-0 flex-1 items-center gap-1 rounded-sm text-sm font-normal focus-visible:outline-1 focus-visible:outline-(--vscode-focusBorder) cursor-default',
				)}
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

function DataList<T>({
	ariaLabel,
	items: itemsProp,
	groups = [],
	selectedKey: selectedKeyProp,
	role = 'listbox',
	itemRole = 'option',
	onFocusedKeyChange,
	onActivate,
	onItemClick,
	onKeyDown,
}: DataListProps<T>) {
	const items = itemsProp ?? groups.flatMap(group => group.items);
	const listId = useId();
	const listRef = useRef<HTMLDivElement>(null);
	const [focusedKey, setFocusedKey] = useState<Key | null>(null);
	const [selectedKey, setSelectedKey] = useState<Key | null>(selectedKeyProp ?? null);
	const [listHasFocus, setListHasFocus] = useState(false);
	useEffect(() => {
		setSelectedKey(selectedKeyProp ?? null);
	}, [selectedKeyProp]);
	const activeListItem = items.find(item => item.key === focusedKey) ?? items[0];
	const activeKey = activeListItem?.key ?? null;
	const activeItem = activeListItem?.data;
	useEffect(() => {
		onFocusedKeyChange?.(activeKey);
	}, [activeKey, onFocusedKeyChange]);

	const focusItem = (item: T | undefined) => {
		if (item === undefined) return;
		const key = items.find(listItem => listItem.data === item)?.key;
		if (key === undefined) return;
		setFocusedKey(key);
		setSelectedKey(key);
	};

	const handleItemClick = (listItem: DataListItem<T>, event: MouseEvent<HTMLDivElement>) => {
		listRef.current?.focus();
		setFocusedKey(listItem.key);
		setSelectedKey(listItem.key);
		onItemClick?.(listItem.data, event);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const isListKey = ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key);
		if (!isListKey) {
			onKeyDown?.(event, activeItem, focusItem);
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		if (!items.length) return;

		const activeIndex = activeListItem === undefined ? -1 : items.indexOf(activeListItem);
		switch (event.key) {
			case 'ArrowDown':
				focusItem(items[Math.min(activeIndex < 0 ? 0 : activeIndex + 1, items.length - 1)].data);
				break;
			case 'ArrowUp':
				focusItem(items[Math.max(activeIndex < 0 ? items.length - 1 : activeIndex - 1, 0)].data);
				break;
			case 'Home':
				focusItem(items[0].data);
				break;
			case 'End':
				focusItem(items[items.length - 1].data);
				break;
			case 'Enter':
				if (activeItem !== undefined) onActivate?.(activeItem);
				break;
			case ' ':
				if (activeItem !== undefined) onActivate?.(activeItem);
				break;
		}
	};

	return (
		<div
			ref={listRef}
			className="outline-none"
			role={role}
			aria-label={ariaLabel}
			aria-activedescendant={activeKey === null ? undefined : getListItemId(listId, activeKey)}
			tabIndex={items.length ? 0 : -1}
			onFocus={() => {
				setListHasFocus(true);
				if (!items.some(item => item.key === focusedKey)) {
					setFocusedKey(items[0]?.key ?? null);
				}
			}}
			onBlur={() => setListHasFocus(false)}
			onKeyDown={handleKeyDown}
		>
			{groups.length > 0
				? groups.map(group => (
						<div
							key={group.key}
							role="group"
							aria-label={typeof group.label === 'string' ? group.label : undefined}
						>
							<div className="px-2 py-1 text-sm font-semibold text-(--vscode-descriptionForeground)">
								{group.label}
							</div>
							{group.items.map(listItem => (
								<DataListRow
									key={listItem.key}
									listItem={listItem}
									listId={listId}
									itemRole={itemRole}
									selected={listItem.key === selectedKey}
									focused={listItem.key === activeKey}
									listHasFocus={listHasFocus}
									onClick={event => handleItemClick(listItem, event)}
								/>
							))}
						</div>
					))
				: items.map(listItem => (
						<DataListRow
							key={listItem.key}
							listItem={listItem}
							listId={listId}
							itemRole={itemRole}
							selected={listItem.key === selectedKey}
							focused={listItem.key === activeKey}
							listHasFocus={listHasFocus}
							onClick={event => handleItemClick(listItem, event)}
						/>
					))}
		</div>
	);
}

type DataListRowProps<T> = {
	listItem: DataListItem<T>;
	listId: string;
	itemRole: AriaRole;
	selected: boolean;
	focused: boolean;
	listHasFocus: boolean;
	onClick: (event: MouseEvent<HTMLDivElement>) => void;
};

function DataListRow<T>({
	listItem,
	listId,
	itemRole,
	selected,
	focused,
	listHasFocus,
	onClick,
}: DataListRowProps<T>) {
	const state = { focused, selected, listHasFocus };
	const icon = typeof listItem.icon === 'function' ? listItem.icon(state) : listItem.icon;

	return (
		<div
			id={getListItemId(listId, listItem.key)}
			data-vscode-context={listItem.context ? JSON.stringify(listItem.context) : undefined}
			className={cn(
				'group relative flex min-h-6 w-full cursor-pointer items-center gap-1 px-1 text-sm rounded-sm',
				focused &&
					listHasFocus &&
					'outline -outline-offset-1 outline-(--vscode-list-focusOutline,var(--vscode-focusBorder))',
				!selected &&
					'hover:bg-(--vscode-list-hoverBackground) hover:text-(--vscode-list-hoverForeground)',
				selected &&
					listHasFocus &&
					'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)',
				selected &&
					!listHasFocus &&
					'bg-(--vscode-list-inactiveSelectionBackground) text-(--vscode-list-inactiveSelectionForeground)',
			)}
			role={itemRole}
			aria-selected={selected}
			aria-expanded={listItem.expanded}
			aria-level={listItem.level}
			aria-posinset={listItem.position}
			aria-setsize={listItem.setSize}
			onClick={onClick}
		>
			{icon}
			<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
				<span className="truncate">{listItem.label}</span>
				{listItem.description !== undefined && (
					<span className="truncate text-sm text-(--vscode-descriptionForeground)">
						{listItem.description}
					</span>
				)}
			</div>
			{listItem.actions && (
				<div
					className="flex shrink-0 items-center opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
					data-list-actions
					onClick={event => event.stopPropagation()}
					onKeyDown={event => event.stopPropagation()}
				>
					{listItem.actions}
				</div>
			)}
		</div>
	);
}

function getListItemId(listId: string, key: Key): string {
	return `${listId}-item-${encodeURIComponent(String(key))}`;
}
