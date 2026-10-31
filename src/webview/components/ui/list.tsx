import { cn } from 'cn';
import { useEffect, useId, useRef, useState } from 'react';
import type { AriaRole, Key, KeyboardEvent, MouseEvent, ReactNode } from 'react';

export type ListItemState = {
  selected: boolean;
  listHasFocus: boolean;
};

export type ListItem<T> = {
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

export type ListGroup<T> = {
  key: Key;
  label: ReactNode;
  items: readonly ListItem<T>[];
};

type ListPropsBase<T> = {
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

type ListProps<T> =
  | (ListPropsBase<T> & { items: readonly ListItem<T>[]; groups?: never })
  | (ListPropsBase<T> & { items?: never; groups: readonly ListGroup<T>[] });

export function List<T>({
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
}: ListProps<T>) {
  const items = itemsProp ?? groups.flatMap((group) => group.items);
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedKey, setFocusedKey] = useState<Key | null>(null);
  const [selectedKey, setSelectedKey] = useState<Key | null>(selectedKeyProp ?? null);
  const [listHasFocus, setListHasFocus] = useState(false);

  useEffect(() => {
    setSelectedKey(selectedKeyProp ?? null);
  }, [selectedKeyProp]);

  const activeListItem: ListItem<T> | undefined = items.find((item) => item.key === focusedKey) ?? items[0];
  const activeKey = activeListItem?.key ?? null;
  const activeItem = activeListItem?.data;

  useEffect(() => {
    onFocusedKeyChange?.(activeKey);
  }, [activeKey, onFocusedKeyChange]);

  const selectKey = (key: Key) => {
    setFocusedKey(key);
    setSelectedKey(key);
  };

  const focusItem = (item: T | undefined) => {
    if (item === undefined) return;
    const listItem = items.find((candidate) => candidate.data === item);
    if (listItem) selectKey(listItem.key);
  };

  const handleItemClick = (listItem: ListItem<T>, event: MouseEvent<HTMLDivElement>) => {
    listRef.current?.focus();
    selectKey(listItem.key);
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

    if (event.key === 'Enter' || event.key === ' ') {
      if (activeItem !== undefined) onActivate?.(activeItem);
      return;
    }

    const activeIndex = Math.max(
      items.findIndex((item) => item.key === activeKey),
      0,
    );
    const last = items.length - 1;
    const targetIndexes: Partial<Record<string, number>> = {
      ArrowDown: Math.min(activeIndex + 1, last),
      ArrowUp: Math.max(activeIndex - 1, 0),
      Home: 0,
      End: last,
    };
    selectKey(items[targetIndexes[event.key] ?? activeIndex].key);
  };

  const renderRow = (listItem: ListItem<T>) => (
    <ListRow
      key={listItem.key}
      listItem={listItem}
      listId={listId}
      itemRole={itemRole}
      selected={listItem.key === selectedKey}
      listHasFocus={listHasFocus}
      onClick={(event) => handleItemClick(listItem, event)}
    />
  );

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
        setFocusedKey(activeKey);
      }}
      onBlur={() => setListHasFocus(false)}
      onKeyDown={handleKeyDown}
    >
      {groups.length > 0
        ? groups.map((group) => (
            <div key={group.key} role="group" aria-label={typeof group.label === 'string' ? group.label : undefined}>
              <div className="px-2 py-1 font-semibold text-(--vscode-descriptionForeground)">{group.label}</div>
              {group.items.map(renderRow)}
            </div>
          ))
        : items.map(renderRow)}
    </div>
  );
}

type ListRowProps<T> = {
  listItem: ListItem<T>;
  listId: string;
  itemRole: AriaRole;
  selected: boolean;
  listHasFocus: boolean;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
};

function ListRow<T>({ listItem, listId, itemRole, selected, listHasFocus, onClick }: ListRowProps<T>) {
  const icon = typeof listItem.icon === 'function' ? listItem.icon({ selected, listHasFocus }) : listItem.icon;

  return (
    <div
      id={getListItemId(listId, listItem.key)}
      data-vscode-context={listItem.context ? JSON.stringify(listItem.context) : undefined}
      className={cn(
        'group relative flex h-6 w-full cursor-pointer items-center px-1 rounded-sm select-none',
        getSelectionClassName(selected, listHasFocus),
      )}
      role={itemRole}
      aria-selected={selected}
      aria-expanded={listItem.expanded}
      aria-level={listItem.level}
      aria-posinset={listItem.position}
      aria-setsize={listItem.setSize}
      onClick={onClick}
    >
      <div className="flex items-center gap-1 flex-1 truncate h-full">
        {icon}
        <div className="flex min-w-0 flex-1 items-baseline gap-1 overflow-hidden">
          <div className="max-w-full shrink-0 truncate">{listItem.label}</div>
          {listItem.description !== undefined && (
            <div className="min-w-0 text-sm truncate text-(--vscode-descriptionForeground)">{listItem.description}</div>
          )}
        </div>
      </div>
      {listItem.actions && (
        <div
          className="flex shrink-0 items-center opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
          data-list-actions
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {listItem.actions}
        </div>
      )}
    </div>
  );
}

function getSelectionClassName(selected: boolean, listHasFocus: boolean): string {
  if (!selected) return 'hover:bg-(--vscode-list-hoverBackground) hover:text-(--vscode-list-hoverForeground)';
  return listHasFocus
    ? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)'
    : 'bg-(--vscode-list-inactiveSelectionBackground) text-(--vscode-list-inactiveSelectionForeground)';
}

function getListItemId(listId: string, key: Key): string {
  return `${listId}-item-${encodeURIComponent(String(key))}`;
}
