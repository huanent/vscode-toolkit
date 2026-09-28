import type { ArchiveTreeEntry } from '@/features/archive/protocol';
import { DisclosureIcon, FileIcon, FolderIcon } from '@/webview/components/icons';
import { Tree } from '@/webview/components/tree';

export function ArchiveContents({ name, entries }: { name: string; entries: ArchiveTreeEntry[] }) {
	return (
		<main className="flex min-h-screen flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
			<div className="min-h-0 flex-1 overflow-auto px-2">
				{entries.length ? (
					<Tree
						ariaLabel={`${name} contents`}
						items={entries}
						getChildren={(entry) => entry.children ?? []}
						getKey={getArchiveEntryPath}
						getLabel={(entry) => entry.name}
						isBranch={(entry) => entry.type === 'directory'}
						renderExpandIcon={(expanded) => <DisclosureIcon expanded={expanded} size="lg" />}
						renderItem={(entry, { expanded, path }) => (
							<>
								{entry.type === 'file' ? <FileIcon size="lg" /> : <FolderIcon expanded={expanded} size="lg" />}
								<span
									className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
									title={getArchiveEntryPath(path)}
								>
									{entry.name}
								</span>
								<span className="w-20 shrink-0 overflow-hidden text-right text-xs text-ellipsis whitespace-nowrap text-(--vscode-descriptionForeground)">
									{entry.type === 'file' ? formatSize(entry.size) : ''}
								</span>
							</>
						)}
					/>
				) : (
					<div className="grid h-full place-items-center text-(--vscode-descriptionForeground)">
						This archive is empty.
					</div>
				)}
			</div>
		</main>
	);
}

function getArchiveEntryPath(path: readonly ArchiveTreeEntry[]): string {
	return path.map((entry) => entry.name).join('/');
}

function formatSize(size: number): string {
	if (size < 1024) return `${size} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = size;
	let unitIndex = -1;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}
