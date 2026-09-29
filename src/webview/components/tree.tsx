import { cn } from 'cn';
import { useEffect, useId, useRef, useState } from 'react';
import type { Key, KeyboardEvent, MouseEvent, ReactNode } from 'react';

export type TreeItemRenderContext<TItem> = {
  expanded: boolean;
  hasChildren: boolean;
  path: readonly TItem[];
};

type TreeProps<TItem> = {
  ariaLabel: string;
  className?: string;
  collapseAllTrigger?: number;
  items: readonly TItem[];
  getChildren: (item: TItem) => readonly TItem[];
  getKey: (path: readonly TItem[]) => Key;
  getLabel: (item: TItem) => string;
  /** VS Code webview context of a row, exposed as `data-vscode-context` for `webview/context` menus. */
  getItemContext?: (item: TItem, path: readonly TItem[]) => Record<string, unknown> | undefined;
  isBranch: (item: TItem) => boolean;
  onActivate?: (item: TItem, path: readonly TItem[]) => void;
  renderExpandIcon: (expanded: boolean) => ReactNode;
  renderItem: (item: TItem, context: TreeItemRenderContext<TItem>) => ReactNode;
};

type TreeNodeModel<TItem> = {
  item: TItem;
  path: readonly TItem[];
  key: Key;
  parentKey: Key | null;
  label: string;
  children: TreeNodeModel<TItem>[];
  level: number;
  position: number;
  setSize: number;
  isBranch: boolean;
  hasChildren: boolean;
  expandable: boolean;
  expanded: boolean;
};

export function Tree<TItem>({
  ariaLabel,
  className,
  collapseAllTrigger,
  items,
  getChildren,
  getKey,
  getLabel,
  getItemContext,
  isBranch,
  onActivate,
  renderExpandIcon,
  renderItem,
}: TreeProps<TItem>) {
  const treeId = useId();
  const treeRef = useRef<HTMLDivElement>(null);
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<Key>>(() => new Set());
  const [focusedKey, setFocusedKey] = useState<Key | null>(null);
  const [selectedKey, setSelectedKey] = useState<Key | null>(null);
  const [treeHasFocus, setTreeHasFocus] = useState(false);
  useEffect(() => {
    setExpandedKeys(new Set());
  }, [collapseAllTrigger]);
  const treeItems = createTreeNodes(items, [], null, expandedKeys, getChildren, getKey, getLabel, isBranch);
  const visibleItems = flattenTreeNodes(treeItems);
  const activeItem = visibleItems.find((node) => node.key === focusedKey) ?? visibleItems[0];
  const activeIndentKeys = new Set<Key>();
  for (const key of [focusedKey, selectedKey]) {
    const node = visibleItems.find((item) => item.key === key);
    if (!node) continue;
    const guideKey = node.expandable && node.expanded ? node.key : node.parentKey;
    if (guideKey !== null) activeIndentKeys.add(guideKey);
  }

  const updateExpanded = (key: Key, expanded: boolean) => {
    setExpandedKeys((current) => {
      if (current.has(key) === expanded) return current;
      const next = new Set(current);
      if (expanded) next.add(key);
      else next.delete(key);
      return next;
    });
  };
  const toggleExpanded = (key: Key) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const focusItem = (node: TreeNodeModel<TItem> | undefined) => {
    if (!node) return;
    setFocusedKey(node.key);
    setSelectedKey(node.key);
  };
  const handleItemClick = (node: TreeNodeModel<TItem>, event: MouseEvent<HTMLDivElement>) => {
    const isExpanderClick = event.target instanceof Element && event.target.closest('[data-tree-expander]') !== null;
    treeRef.current?.focus();
    setFocusedKey(node.key);
    if (isExpanderClick) {
      if (node.expandable) toggleExpanded(node.key);
      return;
    }
    setSelectedKey(node.key);
    if (node.expandable) toggleExpanded(node.key);
    else if (!node.isBranch) onActivate?.(node.item, node.path);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isTreeKey = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(
      event.key,
    );
    if (!isTreeKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (!visibleItems.length) return;

    const activeIndex = activeItem ? visibleItems.indexOf(activeItem) : -1;
    const currentItem = activeIndex >= 0 ? visibleItems[activeIndex] : undefined;
    switch (event.key) {
      case 'ArrowDown':
        focusItem(visibleItems[Math.min(activeIndex < 0 ? 0 : activeIndex + 1, visibleItems.length - 1)]);
        break;
      case 'ArrowUp':
        focusItem(visibleItems[Math.max(activeIndex < 0 ? visibleItems.length - 1 : activeIndex - 1, 0)]);
        break;
      case 'Home':
        focusItem(visibleItems[0]);
        break;
      case 'End':
        focusItem(visibleItems[visibleItems.length - 1]);
        break;
      case 'ArrowLeft':
        if (!currentItem) break;
        if (currentItem.expandable && currentItem.expanded) {
          updateExpanded(currentItem.key, false);
        } else if (currentItem.parentKey !== null) {
          focusItem(visibleItems.find((node) => node.key === currentItem.parentKey));
        }
        break;
      case 'ArrowRight':
        if (!currentItem?.expandable) break;
        if (currentItem.expanded) focusItem(currentItem.children[0]);
        else updateExpanded(currentItem.key, true);
        break;
      case 'Enter':
        if (currentItem?.expandable) toggleExpanded(currentItem.key);
        else if (currentItem && !currentItem.isBranch) onActivate?.(currentItem.item, currentItem.path);
        break;
      case ' ':
        if (currentItem?.expandable) toggleExpanded(currentItem.key);
        break;
    }
  };

  return (
    <div
      ref={treeRef}
      className={cn('outline-none', className)}
      role="tree"
      aria-label={ariaLabel}
      aria-activedescendant={activeItem ? getTreeItemId(treeId, activeItem.key) : undefined}
      tabIndex={visibleItems.length ? 0 : -1}
      onFocus={() => {
        setTreeHasFocus(true);
        if (!visibleItems.some((node) => node.key === focusedKey)) {
          setFocusedKey(visibleItems[0]?.key ?? null);
        }
      }}
      onBlur={() => setTreeHasFocus(false)}
      onKeyDown={handleKeyDown}
    >
      {visibleItems.map((node) => (
        <TreeRow
          key={node.key}
          node={node}
          treeId={treeId}
          getKey={getKey}
          getItemContext={getItemContext}
          activeIndentKeys={activeIndentKeys}
          focusedKey={activeItem?.key ?? null}
          selectedKey={selectedKey}
          treeHasFocus={treeHasFocus}
          renderExpandIcon={renderExpandIcon}
          renderItem={renderItem}
          onItemClick={handleItemClick}
        />
      ))}
    </div>
  );
}

function createTreeNodes<TItem>(
  items: readonly TItem[],
  parentPath: readonly TItem[],
  parentKey: Key | null,
  expandedKeys: ReadonlySet<Key>,
  getChildren: TreeProps<TItem>['getChildren'],
  getKey: TreeProps<TItem>['getKey'],
  getLabel: TreeProps<TItem>['getLabel'],
  isBranch: TreeProps<TItem>['isBranch'],
): TreeNodeModel<TItem>[] {
  return items.map((item, index) => {
    const path = [...parentPath, item];
    const key = getKey(path);
    const children = getChildren(item);
    const branch = isBranch(item);
    const expandable = branch && children.length > 0;
    const expanded = expandable && expandedKeys.has(key);
    return {
      item,
      path,
      key,
      parentKey,
      label: getLabel(item),
      children: expanded
        ? createTreeNodes(children, path, key, expandedKeys, getChildren, getKey, getLabel, isBranch)
        : [],
      level: path.length,
      position: index + 1,
      setSize: items.length,
      isBranch: branch,
      hasChildren: children.length > 0,
      expandable,
      expanded,
    };
  });
}

function flattenTreeNodes<TItem>(nodes: readonly TreeNodeModel<TItem>[]): TreeNodeModel<TItem>[] {
  return nodes.flatMap((node) => [node, ...flattenTreeNodes(node.children)]);
}

function getTreeItemId(treeId: string, key: Key): string {
  return `${treeId}-item-${encodeURIComponent(String(key))}`;
}

type TreeRowProps<TItem> = Pick<TreeProps<TItem>, 'getKey' | 'getItemContext' | 'renderExpandIcon' | 'renderItem'> & {
  node: TreeNodeModel<TItem>;
  treeId: string;
  activeIndentKeys: ReadonlySet<Key>;
  focusedKey: Key | null;
  selectedKey: Key | null;
  treeHasFocus: boolean;
  onItemClick: (node: TreeNodeModel<TItem>, event: MouseEvent<HTMLDivElement>) => void;
};

function TreeRow<TItem>({
  node,
  treeId,
  getKey,
  getItemContext,
  activeIndentKeys,
  focusedKey,
  selectedKey,
  treeHasFocus,
  renderExpandIcon,
  renderItem,
  onItemClick,
}: TreeRowProps<TItem>) {
  const selected = node.key === selectedKey;
  const focused = node.key === focusedKey;
  const itemContext = getItemContext?.(node.item, node.path);
  return (
    <div
      id={getTreeItemId(treeId, node.key)}
      data-vscode-context={itemContext ? JSON.stringify(itemContext) : undefined}
      className={cn(
        'relative flex h-7 w-full items-center rounded pl-2 pr-2 cursor-pointer',
        !selected && 'hover:bg-(--vscode-list-hoverBackground) hover:text-(--vscode-list-hoverForeground)',
        selected &&
          treeHasFocus &&
          'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)',
        selected &&
          !treeHasFocus &&
          'bg-(--vscode-list-inactiveSelectionBackground) text-(--vscode-list-inactiveSelectionForeground)',
        focused && treeHasFocus && !selected && 'outline outline-(--vscode-list-focusOutline)',
      )}
      role="treeitem"
      aria-expanded={node.isBranch ? node.expanded : undefined}
      aria-selected={selected}
      aria-level={node.level}
      aria-posinset={node.position}
      aria-setsize={node.setSize}
      onClick={(event) => onItemClick(node, event)}
    >
      <TreeRowIndentation
        node={node}
        getKey={getKey}
        activeIndentKeys={activeIndentKeys}
        renderExpandIcon={renderExpandIcon}
      />
      <TreeRowContent node={node} renderItem={renderItem} />
    </div>
  );
}

type TreeRowIndentationProps<TItem> = Pick<TreeProps<TItem>, 'getKey' | 'renderExpandIcon'> & {
  node: TreeNodeModel<TItem>;
  activeIndentKeys: ReadonlySet<Key>;
};

function TreeRowIndentation<TItem>({
  node,
  getKey,
  activeIndentKeys,
  renderExpandIcon,
}: TreeRowIndentationProps<TItem>) {
  return (
    <div className="flex h-full shrink-0 items-center">
      <TreeIndentGuides path={node.path} getKey={getKey} activeIndentKeys={activeIndentKeys} />
      {node.path.slice(0, -1).map((_, index) => (
        <span key={`indent-${index}`} className={cn('relative z-10 shrink-0 self-stretch', 'w-4')} aria-hidden="true" />
      ))}
      {node.isBranch ? (
        <span
          className={cn(
            'relative z-10 mr-1 grid size-5 shrink-0 place-items-center self-center',
            node.expandable && 'cursor-pointer',
          )}
          data-tree-expander
          aria-hidden="true"
        >
          {renderExpandIcon(node.expanded)}
        </span>
      ) : null}
    </div>
  );
}

type TreeIndentGuidesProps<TItem> = Pick<TreeRowIndentationProps<TItem>, 'getKey' | 'activeIndentKeys'> & {
  path: readonly TItem[];
};

function TreeIndentGuides<TItem>({ path, getKey, activeIndentKeys }: TreeIndentGuidesProps<TItem>) {
  return (
    <div className="pointer-events-none absolute inset-y-0 left-4 z-0 flex" aria-hidden="true">
      {path.slice(0, -1).map((_, index) => {
        const guideKey = getKey(path.slice(0, index + 1));
        const active = activeIndentKeys.has(guideKey);
        return (
          <span
            key={index}
            className={cn(
              'shrink-0 self-stretch border-l',
              'w-4',
              active
                ? 'border-(--vscode-tree-indentGuidesStroke) opacity-100'
                : 'border-(--vscode-tree-inactiveIndentGuidesStroke) opacity-60',
            )}
          />
        );
      })}
    </div>
  );
}

type TreeRowContentProps<TItem> = Pick<TreeProps<TItem>, 'renderItem'> & {
  node: TreeNodeModel<TItem>;
};

function TreeRowContent<TItem>({ node, renderItem }: TreeRowContentProps<TItem>) {
  return (
    <div className="relative z-10 flex h-full min-w-0 flex-1 items-center gap-1">
      {renderItem(node.item, { expanded: node.expanded, hasChildren: node.hasChildren, path: node.path })}
    </div>
  );
}
