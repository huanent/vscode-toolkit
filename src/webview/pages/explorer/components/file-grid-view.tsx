import type { ExplorerEntry } from '@/features/explorer/protocol';
import { Icon } from '@/webview/components/icons';
import { formatDateTime, formatSize } from '@/webview/utils/format';

type FileGridViewProps = {
  entries: readonly ExplorerEntry[];
  onOpen: (entry: ExplorerEntry) => void;
};

function describeEntry(entry: ExplorerEntry): string {
  return [
    entry.name,
    entry.modifiedAt === undefined ? undefined : `Modified: ${formatDateTime(entry.modifiedAt)}`,
    entry.createdAt === undefined ? undefined : `Created: ${formatDateTime(entry.createdAt)}`,
    entry.size === undefined ? undefined : `Size: ${formatSize(entry.size)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function FileGridView({ entries, onOpen }: FileGridViewProps) {
  return (
    <ul aria-label="Files" className="min-h-0 flex-1 overflow-auto grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] content-start gap-2 p-2">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            title={describeEntry(entry)}
            className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-md border border-transparent p-3 transition-colors hover:border-(--vscode-focusBorder) hover:bg-(--vscode-list-hoverBackground) focus-visible:outline focus-visible:outline-1 focus-visible:outline-(--vscode-focusBorder)"
            onDoubleClick={() => onOpen(entry)}
          >
            <Icon name={entry.type === 'directory' ? 'folder' : 'file'} size="2xl" />
            <span className="line-clamp-2 w-full wrap-break-word text-center text-sm leading-4">{entry.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
