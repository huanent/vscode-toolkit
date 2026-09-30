import { cn } from 'cn';
import { DisclosureIcon, Icon } from '@/webview/components/icons';
import { List, type ListItemState } from '@/webview/components/list';
import { useEffect, useState } from 'react';
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
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<Key>>(() => new Set());
  useEffect(() => {
    setExpandedKeys(new Set());
  }, [collapseAllTrigger]);
  const treeItems = createTreeNodes(items, null, expandedKeys);
  const visibleItems = flattenTreeNodes(treeItems);
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
  const handleItemClick = (node: TreeNodeModel, event: MouseEvent<HTMLDivElement>) => {
    const isExpanderClick = event.target instanceof Element && event.target.closest('[data-tree-expander]') !== null;
    if (isExpanderClick) {
      if (node.expandable) toggleExpanded(node.key);
    } else if (node.expandable) {
      toggleExpanded(node.key);
    } else if (node.item.type === 'file') {
      onActivate?.(node.item);
    }
  };
  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    currentItem: TreeNodeModel | undefined,
    focusItem: (item: TreeNodeModel | undefined) => void,
  ) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!currentItem) return;
    if (event.key === 'ArrowLeft') {
      if (currentItem.expandable && currentItem.expanded) updateExpanded(currentItem.key, false);
      else if (currentItem.parentKey !== null)
        focusItem(visibleItems.find((node) => node.key === currentItem.parentKey));
      return;
    }
    if (!currentItem.expandable) return;
    if (currentItem.expanded) focusItem(currentItem.children[0]);
    else updateExpanded(currentItem.key, true);
  };

  return (
    <List
      ariaLabel={ariaLabel}
      items={visibleItems.map((node) => ({
        key: node.key,
        data: node,
        icon: (state) => (
          <>
            <TreeRowIndentation node={node} state={state} />
            {node.item.type === 'file' && <Icon name="file" />}
          </>
        ),
        label: node.item.name,
        description: node.item.type === 'file' ? node.item.detail : undefined,
        context: node.item.context,
        expanded: node.item.type === 'directory' ? node.expanded : undefined,
        level: node.level,
        position: node.position,
        setSize: node.setSize,
      }))}
      role="tree"
      itemRole="treeitem"
      onActivate={(node) => {
        if (node.expandable) toggleExpanded(node.key);
        else if (node.item.type === 'file') onActivate?.(node.item);
      }}
      onItemClick={handleItemClick}
      onKeyDown={handleKeyDown}
    />
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

function getTreeDepth(path: string): number {
  return path.split('/').filter(Boolean).length;
}

type TreeRowIndentationProps = {
  node: TreeNodeModel;
  state: ListItemState;
};

function TreeRowIndentation({ node, state }: TreeRowIndentationProps) {
  const activeIndentKeys = new Set<Key>();
  if (state.focused || state.selected) {
    const guideKey = node.expandable && node.expanded ? node.key : node.parentKey;
    if (guideKey !== null) activeIndentKeys.add(guideKey);
  }
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
