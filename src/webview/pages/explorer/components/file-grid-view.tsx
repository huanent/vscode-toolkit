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
    <ul aria-label="Files" className="flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-auto p-2">
      {entries.map((entry) => (
        <li key={entry.id} className="w-24 max-w-full min-w-0">
          <button
            type="button"
            title={describeEntry(entry)}
            className="flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-transparent px-2 py-1 transition-colors hover:bg-(--vscode-list-hoverBackground) focus-visible:border-(--vscode-focusBorder) focus-visible:bg-(--vscode-list-hoverBackground)"
            onDoubleClick={() => onOpen(entry)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onOpen(entry);
            }}
          >
            <div className="flex size-8 shrink-0 items-center justify-center">
              <Icon name={entry.type === 'directory' ? 'folder' : 'file'} size="3xl" />
            </div>
            <span className="line-clamp-2 h-8 w-full wrap-anywhere text-center text-sm leading-4">{entry.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
