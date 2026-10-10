import { cn } from 'cn';
import { ChevronRight, DisclosureIcon, Icon } from '@/webview/components/icons';
import { List } from '@/webview/components/list';
import {
	useEffect,
	useState,
	type ComponentPropsWithoutRef,
	type Key,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
} from 'react';

type TreeItemBase = {
	path: string;
	name: string;
	context?: Readonly<Record<string, string | number | boolean>>;
};

export type TreeItem =
	| (TreeItemBase & { type: 'file'; detail?: string })
	| (TreeItemBase & { type: 'directory'; children?: readonly TreeItem[] });

type TreeFileItem = Extract<TreeItem, { type: 'file' }>;

export type DataTreeProps = {
	ariaLabel: string;
	collapseAllTrigger?: number;
	items: readonly TreeItem[];
	onActivate?: (item: TreeFileItem) => void;
	label?: never;
};

export type SimpleTreeProps = ComponentPropsWithoutRef<'details'> & {
	label: ReactNode;
	count?: number;
	summaryProps?: ComponentPropsWithoutRef<'summary'> & { 'data-vscode-context'?: string };
	items?: never;
	ariaLabel?: never;
};

export type TreeProps = DataTreeProps | SimpleTreeProps;

function isDataTreeProps(props: TreeProps): props is DataTreeProps {
	return 'items' in props && props.items !== undefined;
}

export function Tree(props: TreeProps) {
	if (isDataTreeProps(props)) {
		return <DataTree {...props} />;
	}
	const {
		label,
		count,
		summaryProps,
		className,
		children,
		items: _items,
		ariaLabel: _ariaLabel,
		...detailsProps
	} = props;
	const { className: summaryClassName, ...summaryAttributes } = summaryProps ?? {};
	return (
		<details
			className={cn('min-w-0 [&[open]>summary>:first-child]:rotate-90', className)}
			{...detailsProps}
		>
			<summary
				className={cn(
					'flex cursor-pointer list-none items-center gap-1 rounded-xs px-1 text-sm font-semibold hover:bg-(--vscode-list-hoverBackground) [&::-webkit-details-marker]:hidden',
					summaryClassName,
				)}
				{...summaryAttributes}
			>
				<ChevronRight />
				<span className="min-w-0 flex-1 wrap-anywhere py-1">{label}</span>
				{count !== undefined && (
					<span className="p-1 text-xs font-normal text-(--vscode-descriptionForeground)">
						{count}
					</span>
				)}
			</summary>
			<div className="ml-2.5 border-l border-(--vscode-tree-indentGuidesStroke) pl-2">
				{children}
			</div>
		</details>
	);
}

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

function DataTree({ ariaLabel, collapseAllTrigger, items, onActivate }: DataTreeProps) {
	const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<Key>>(() => new Set());
	const [focusedKey, setFocusedKey] = useState<Key | null>(null);
	useEffect(() => {
		setExpandedKeys(new Set());
	}, [collapseAllTrigger]);
	const treeItems = createTreeNodes(items, null, expandedKeys);
	const visibleItems = flattenTreeNodes(treeItems);
	const focusedNode = visibleItems.find(node => node.key === focusedKey) ?? visibleItems[0];
	const activeIndentKey = focusedNode
		? focusedNode.expandable && focusedNode.expanded
			? focusedNode.key
			: focusedNode.parentKey
		: null;
	const updateExpanded = (key: Key, expanded: boolean) => {
		setExpandedKeys(current => {
			if (current.has(key) === expanded) return current;
			const next = new Set(current);
			if (expanded) next.add(key);
			else next.delete(key);
			return next;
		});
	};
	const toggleExpanded = (key: Key) => {
		setExpandedKeys(current => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};
	const handleItemClick = (node: TreeNodeModel, event: MouseEvent<HTMLDivElement>) => {
		const isExpanderClick =
			event.target instanceof Element && event.target.closest('[data-tree-expander]') !== null;
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
				focusItem(visibleItems.find(node => node.key === currentItem.parentKey));
			return;
		}
		if (!currentItem.expandable) return;
		if (currentItem.expanded) focusItem(currentItem.children[0]);
		else updateExpanded(currentItem.key, true);
	};

	return (
		<List
			ariaLabel={ariaLabel}
			items={visibleItems.map(node => ({
				key: node.key,
				data: node,
				icon: (
					<>
						<TreeRowIndentation node={node} activeIndentKey={activeIndentKey} />
						{node.item.type === 'file' && <Icon className="py-1" name="file" />}
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
			onFocusedKeyChange={setFocusedKey}
			onActivate={node => {
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
	const sortedItems = [...items].sort((first, second) => {
		if (first.type !== second.type) return first.type === 'directory' ? -1 : 1;
		return first.name.localeCompare(second.name);
	});
	return sortedItems.map((item, index) => {
		const key = item.path;
		const children = item.type === 'directory' ? (item.children ?? []) : [];
		const expandable = item.type === 'directory';
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
	return nodes.flatMap(node => [node, ...flattenTreeNodes(node.children)]);
}

function getTreeDepth(path: string): number {
	return path.split('/').filter(Boolean).length;
}

type TreeRowIndentationProps = {
	node: TreeNodeModel;
	activeIndentKey: Key | null;
};

function TreeRowIndentation({ node, activeIndentKey }: TreeRowIndentationProps) {
	return (
		<div className="relative flex shrink-0 items-center self-stretch">
			<TreeIndentGuides itemPath={node.item.path} activeIndentKey={activeIndentKey} />
			{Array.from({ length: node.level - 1 }, (_, index) => (
				<span
					key={`indent-${index}`}
					className={cn('relative z-10 shrink-0 self-stretch', 'w-5')}
					aria-hidden="true"
				/>
			))}
			{node.item.type === 'directory' ? (
				<span
					className={cn(
						'relative z-10 py-1 ml-1 grid shrink-0 place-items-center self-center',
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
	activeIndentKey: Key | null;
};

function TreeIndentGuides({ itemPath, activeIndentKey }: TreeIndentGuidesProps) {
	const pathSegments = itemPath.split('/').filter(Boolean);
	return (
		<div className="pointer-events-none absolute inset-y-0 left-3 z-0 flex" aria-hidden="true">
			{pathSegments.slice(0, -1).map((_, index) => {
				const guideKey = pathSegments.slice(0, index + 1).join('/');
				const active = activeIndentKey === guideKey;
				return (
					<span
						key={index}
						className={cn(
							'shrink-0 self-stretch border-l',
							'w-5',
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
