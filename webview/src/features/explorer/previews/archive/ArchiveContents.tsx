import { cn } from 'cn';
import { useMemo, useState } from 'react';
import type { ArchiveTreeEntry } from '../../../../../../src/features/explorer/archive/protocol';
import { formatSize, getFileIcon } from '../../shared/formatters';

export function ArchiveContents({ name, entries }: { name: string; entries: ArchiveTreeEntry[] }) {
	const summary = useMemo(() => summarize(entries), [entries]);

	return (
		<main className="flex h-full flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
			<header className="flex h-11 shrink-0 items-center gap-2 border-b border-(--vscode-panel-border) px-3">
				<i
					className="codicon codicon-file-zip text-base text-(--vscode-icon-foreground)"
					aria-hidden="true"
				/>
				<div className="flex min-w-0 flex-1 items-baseline gap-2">
					<h1 className="m-0 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">
						{name}
					</h1>
					<p className="m-0 shrink-0 whitespace-nowrap text-xs text-(--vscode-descriptionForeground)">
						{summary.files} files, {summary.directories} folders, {formatSize(summary.size)}
					</p>
				</div>
			</header>
			<div
				className="min-h-0 flex-1 overflow-auto px-2 py-2"
				role="tree"
				aria-label={`${name} contents`}
			>
				{entries.length ? (
					entries.map(entry => (
						<ArchiveTreeRow key={entry.name} entry={entry} path={entry.name} depth={0} />
					))
				) : (
					<div className="grid h-full place-items-center text-(--vscode-descriptionForeground)">
						This archive is empty.
					</div>
				)}
			</div>
		</main>
	);
}

function ArchiveTreeRow({
	entry,
	path,
	depth,
}: {
	entry: ArchiveTreeEntry;
	path: string;
	depth: number;
}) {
	const [expanded, setExpanded] = useState(false);
	const directory = entry.type === 'directory';
	const hasChildren = Boolean(entry.children?.length);

	return (
		<>
			<div
				className="grid h-7 grid-cols-[minmax(0,1fr)_90px] items-center rounded-sm pr-2 hover:bg-(--vscode-list-hoverBackground) hover:text-(--vscode-list-hoverForeground)"
				role="treeitem"
				aria-expanded={directory ? expanded : undefined}
				style={{ paddingLeft: depth * 16 }}
				onDoubleClick={() => directory && hasChildren && setExpanded(current => !current)}
			>
				<div className="flex min-w-0 items-center gap-1">
					{directory ? (
						<button
							type="button"
							className="grid size-6 shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-inherit disabled:cursor-default disabled:opacity-35"
							disabled={!hasChildren}
							aria-label={`${expanded ? 'Collapse' : 'Expand'} ${entry.name}`}
							onClick={() => setExpanded(current => !current)}
						>
							<i
								className={cn('codicon', `codicon-chevron-${expanded ? 'down' : 'right'}`)}
								aria-hidden="true"
							/>
						</button>
					) : (
						<span className="w-6 shrink-0" />
					)}
					<i
						className={cn(
							'codicon shrink-0 text-base',
							directory
								? `codicon-folder${expanded ? '-opened' : ''} text-(--vscode-symbolIcon-folderForeground,var(--vscode-icon-foreground))`
								: `${getFileIcon(entry.name)} text-(--vscode-symbolIcon-fileForeground,var(--vscode-icon-foreground))`,
						)}
						aria-hidden="true"
					/>
					<span className="overflow-hidden text-ellipsis whitespace-nowrap" title={path}>
						{entry.name}
					</span>
				</div>
				<span className="overflow-hidden text-right text-xs text-ellipsis whitespace-nowrap text-(--vscode-descriptionForeground)">
					{directory ? '' : formatSize(entry.size)}
				</span>
			</div>
			{directory &&
				expanded &&
				entry.children?.map(child => (
					<ArchiveTreeRow
						key={`${path}/${child.name}`}
						entry={child}
						path={`${path}/${child.name}`}
						depth={depth + 1}
					/>
				))}
		</>
	);
}

function summarize(entries: ArchiveTreeEntry[]): {
	files: number;
	directories: number;
	size: number;
} {
	return entries.reduce(
		(summary, entry) => {
			if (entry.type === 'file') {
				summary.files += 1;
				summary.size += entry.size;
			} else {
				summary.directories += 1;
				const children = summarize(entry.children ?? []);
				summary.files += children.files;
				summary.directories += children.directories;
				summary.size += children.size;
			}
			return summary;
		},
		{ files: 0, directories: 0, size: 0 },
	);
}
