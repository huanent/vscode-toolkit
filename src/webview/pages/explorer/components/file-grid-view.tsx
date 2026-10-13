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
    <ul aria-label="Files" className="flex flex-wrap gap-1">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            title={describeEntry(entry)}
            className="flex w-24 cursor-pointer flex-col items-center gap-1 rounded-sm p-2 hover:bg-(--vscode-list-hoverBackground)"
            onClick={() => onOpen(entry)}
          >
            <Icon name={entry.type === 'directory' ? 'folder' : 'file'} size="2xl" />
            <span className="line-clamp-2 w-full wrap-break-word text-center text-sm">{entry.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
