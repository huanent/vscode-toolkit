import { cn } from 'cn';
import { DisclosureIcon, Icon } from '@/webview/components/icons';
import { useEffect, useId, useRef, useState } from 'react';
import type { Key, KeyboardEvent, MouseEvent } from 'react';

type TreeItemBase = {
  path: string;
  name: string;
  context?: Readonly<Record<string, string | number | boolean>>;
};

export type TreeItem =
  | (TreeItemBase & { type: 'file'; detail?: string })
  | (TreeItemBase & { type: 'directory'; children?: readonly TreeItem[] });

type TreeFileItem = Extract<TreeItem, { type: 'file' }>;

type TreeProps = {
  ariaLabel: string;
  collapseAllTrigger?: number;
  items: readonly TreeItem[];
  onActivate?: (item: TreeFileItem) => void;
};

type TreeNodeModel = {
  item: TreeItem;
  key: Key;
  parentKey: Key | null;
  children: TreeNodeModel[];
  level: number;
  position: number;
  setSize: number;
  expandable: boolean;
  expanded: boolean;
};

export function Tree({ ariaLabel, collapseAllTrigger, items, onActivate }: TreeProps) {
  const treeId = useId();
  const treeRef = useRef<HTMLDivElement>(null);
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<Key>>(() => new Set());
  const [focusedKey, setFocusedKey] = useState<Key | null>(null);
  const [selectedKey, setSelectedKey] = useState<Key | null>(null);
  const [treeHasFocus, setTreeHasFocus] = useState(false);
  useEffect(() => {
    setExpandedKeys(new Set());
  }, [collapseAllTrigger]);
  const treeItems = createTreeNodes(items, null, expandedKeys);
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
  const focusItem = (node: TreeNodeModel | undefined) => {
    if (!node) return;
    setFocusedKey(node.key);
    setSelectedKey(node.key);
  };
  const handleItemClick = (node: TreeNodeModel, event: MouseEvent<HTMLDivElement>) => {
    const isExpanderClick = event.target instanceof Element && event.target.closest('[data-tree-expander]') !== null;
    treeRef.current?.focus();
    setFocusedKey(node.key);
    if (isExpanderClick) {
      if (node.expandable) toggleExpanded(node.key);
      return;
    }
    setSelectedKey(node.key);
    if (node.expandable) toggleExpanded(node.key);
    else if (node.item.type === 'file') onActivate?.(node.item);
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
        else if (currentItem?.item.type === 'file') onActivate?.(currentItem.item);
        break;
      case ' ':
        if (currentItem?.expandable) toggleExpanded(currentItem.key);
        break;
    }
  };

  return (
    <div
      ref={treeRef}
      className="outline-none"
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
          activeIndentKeys={activeIndentKeys}
          focusedKey={activeItem?.key ?? null}
          selectedKey={selectedKey}
          treeHasFocus={treeHasFocus}
          onItemClick={handleItemClick}
        />
      ))}
    </div>
  );
}

function createTreeNodes(
  items: readonly TreeItem[],
  parentKey: Key | null,
  expandedKeys: ReadonlySet<Key>,
): TreeNodeModel[] {
  return items.map((item, index) => {
    const key = item.path;
    const children = item.type === 'directory' ? (item.children ?? []) : [];
    const expandable = item.type === 'directory' && children.length > 0;
    const expanded = expandable && expandedKeys.has(key);
    return {
      item,
      key,
      parentKey,
      children: expanded ? createTreeNodes(children, key, expandedKeys) : [],
      level: getTreeDepth(item.path),
      position: index + 1,
      setSize: items.length,
      expandable,
      expanded,
    };
  });
}

function flattenTreeNodes(nodes: readonly TreeNodeModel[]): TreeNodeModel[] {
  return nodes.flatMap((node) => [node, ...flattenTreeNodes(node.children)]);
}

function getTreeItemId(treeId: string, key: Key): string {
  return `${treeId}-item-${encodeURIComponent(String(key))}`;
}

function getTreeDepth(path: string): number {
  return path.split('/').filter(Boolean).length;
}

type TreeRowProps = {
  node: TreeNodeModel;
  treeId: string;
  activeIndentKeys: ReadonlySet<Key>;
  focusedKey: Key | null;
  selectedKey: Key | null;
  treeHasFocus: boolean;
  onItemClick: (node: TreeNodeModel, event: MouseEvent<HTMLDivElement>) => void;
};

function TreeRow({ node, treeId, activeIndentKeys, selectedKey, treeHasFocus, onItemClick }: TreeRowProps) {
  const selected = node.key === selectedKey;
  return (
    <div
      id={getTreeItemId(treeId, node.key)}
      data-vscode-context={node.item.context ? JSON.stringify(node.item.context) : undefined}
      className={cn(
        'relative flex h-7 w-full items-center rounded pl-2 pr-2 cursor-pointer',
        !selected && 'hover:bg-(--vscode-list-hoverBackground) hover:text-(--vscode-list-hoverForeground)',
        selected &&
          treeHasFocus &&
          'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)',
        selected &&
          !treeHasFocus &&
          'bg-(--vscode-list-inactiveSelectionBackground) text-(--vscode-list-inactiveSelectionForeground)',
      )}
      role="treeitem"
      aria-expanded={node.item.type === 'directory' ? node.expanded : undefined}
      aria-selected={selected}
      aria-level={node.level}
      aria-posinset={node.position}
      aria-setsize={node.setSize}
      onClick={(event) => onItemClick(node, event)}
    >
      <TreeRowIndentation node={node} activeIndentKeys={activeIndentKeys} />
      <TreeRowContent node={node} />
    </div>
  );
}

type TreeRowIndentationProps = {
  node: TreeNodeModel;
  activeIndentKeys: ReadonlySet<Key>;
};

function TreeRowIndentation({ node, activeIndentKeys }: TreeRowIndentationProps) {
  return (
    <div className="flex h-full shrink-0 items-center">
      <TreeIndentGuides itemPath={node.item.path} activeIndentKeys={activeIndentKeys} />
      {Array.from({ length: node.level - 1 }, (_, index) => (
        <span key={`indent-${index}`} className={cn('relative z-10 shrink-0 self-stretch', 'w-4')} aria-hidden="true" />
      ))}
      {node.item.type === 'directory' ? (
        <span
          className={cn(
            'relative z-10 mr-1 grid size-5 shrink-0 place-items-center self-center',
            node.expandable && 'cursor-pointer',
          )}
          data-tree-expander
          aria-hidden="true"
        >
          <DisclosureIcon expanded={node.expanded} />
        </span>
      ) : null}
    </div>
  );
}

type TreeIndentGuidesProps = {
  itemPath: string;
  activeIndentKeys: ReadonlySet<Key>;
};

function TreeIndentGuides({ itemPath, activeIndentKeys }: TreeIndentGuidesProps) {
  const pathSegments = itemPath.split('/').filter(Boolean);
  return (
    <div className="pointer-events-none absolute inset-y-0 left-4 z-0 flex" aria-hidden="true">
      {pathSegments.slice(0, -1).map((_, index) => {
        const guideKey = pathSegments.slice(0, index + 1).join('/');
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

type TreeRowContentProps = {
  node: TreeNodeModel;
};

function TreeRowContent({ node }: TreeRowContentProps) {
  return (
    <div className="relative z-10 flex h-full min-w-0 flex-1 items-center gap-1">
      {node.item.type === 'file' && <Icon name="file" />}
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap" title={node.item.path}>
        {node.item.name}
      </span>
      {node.item.type === 'file' && node.item.detail && (
        <span className="w-20 shrink-0 overflow-hidden text-right text-xs text-ellipsis whitespace-nowrap text-(--vscode-descriptionForeground)">
          {node.item.detail}
        </span>
      )}
    </div>
  );
}
