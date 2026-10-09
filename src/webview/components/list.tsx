import { cn } from 'cn';
import { useEffect, useId, useRef, useState } from 'react';
import type { AriaRole, Key, KeyboardEvent, MouseEvent, ReactNode } from 'react';

export type ListItemState = {
  focused: boolean;
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
  const activeListItem = items.find((item) => item.key === focusedKey) ?? items[0];
  const activeKey = activeListItem?.key ?? null;
  const activeItem = activeListItem?.data;
  useEffect(() => {
    onFocusedKeyChange?.(activeKey);
  }, [activeKey, onFocusedKeyChange]);

  const focusItem = (item: T | undefined) => {
    if (item === undefined) return;
    const key = items.find((listItem) => listItem.data === item)?.key;
    if (key === undefined) return;
    setFocusedKey(key);
    setSelectedKey(key);
  };

  const handleItemClick = (listItem: ListItem<T>, event: MouseEvent<HTMLDivElement>) => {
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
        if (!items.some((item) => item.key === focusedKey)) {
          setFocusedKey(items[0]?.key ?? null);
        }
      }}
      onBlur={() => setListHasFocus(false)}
      onKeyDown={handleKeyDown}
    >
      {groups.length > 0
        ? groups.map((group) => (
            <div key={group.key} role="group" aria-label={typeof group.label === 'string' ? group.label : undefined}>
              <div className="px-2 py-1 text-sm font-semibold text-(--vscode-descriptionForeground)">{group.label}</div>
              {group.items.map((listItem) => (
                <ListItem
                  key={listItem.key}
                  listItem={listItem}
                  listId={listId}
                  itemRole={itemRole}
                  selected={listItem.key === selectedKey}
                  focused={listItem.key === activeKey}
                  listHasFocus={listHasFocus}
                  onClick={(event) => handleItemClick(listItem, event)}
                />
              ))}
            </div>
          ))
        : items.map((listItem) => (
            <ListItem
              key={listItem.key}
              listItem={listItem}
              listId={listId}
              itemRole={itemRole}
              selected={listItem.key === selectedKey}
              focused={listItem.key === activeKey}
              listHasFocus={listHasFocus}
              onClick={(event) => handleItemClick(listItem, event)}
            />
          ))}
    </div>
  );
}

type ListItemProps<T> = {
  listItem: ListItem<T>;
  listId: string;
  itemRole: AriaRole;
  selected: boolean;
  focused: boolean;
  listHasFocus: boolean;
  onClick: (event: MouseEvent<HTMLDivElement>) => void;
};

function ListItem<T>({ listItem, listId, itemRole, selected, focused, listHasFocus, onClick }: ListItemProps<T>) {
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
        !selected && 'hover:bg-(--vscode-list-hoverBackground) hover:text-(--vscode-list-hoverForeground)',
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
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{listItem.label}</span>
      {listItem.description !== undefined && (
        <span className="w-20 shrink-0 overflow-hidden text-right text-sm text-ellipsis whitespace-nowrap text-(--vscode-descriptionForeground)">
          {listItem.description}
        </span>
      )}
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

function getListItemId(listId: string, key: Key): string {
  return `${listId}-item-${encodeURIComponent(String(key))}`;
}
