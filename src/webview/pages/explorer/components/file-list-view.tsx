import type { ExplorerEntry } from '@/features/explorer/protocol';
import { Icon } from '@/webview/components/icons';
import { formatDateTime, formatSize } from '@/webview/utils/format';

type FileListViewProps = {
  entries: readonly ExplorerEntry[];
  onOpen: (entry: ExplorerEntry) => void;
};

export function FileListView({ entries, onOpen }: FileListViewProps) {
  return (
    <div aria-label="Files" className="flex min-h-0 flex-1 flex-col bg-(--vscode-editor-background)">
      <div className="flex shrink-0 items-center gap-3 overflow-y-scroll [scrollbar-color:transparent_transparent] border-b border-(--vscode-panel-border) px-4 py-2 text-xs font-medium text-(--vscode-descriptionForeground)">
        <div className="min-w-0 flex-1 pl-6">Name</div>
        <div className="w-36 shrink-0 text-right whitespace-nowrap">Modified</div>
        <div className="w-36 shrink-0 text-right whitespace-nowrap">Created</div>
        <div className="w-14 shrink-0 text-right whitespace-nowrap">Size</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {entries.map((entry) => (
          <div
            key={entry.id}
            tabIndex={0}
            className="mx-1 flex items-center gap-3 px-3 py-1 cursor-pointer outline-none transition-colors hover:bg-(--vscode-list-hoverBackground) focus-visible:outline-1 -outline-offset-1 focus-visible:outline-(--vscode-focusBorder) text-sm rounded"
            onDoubleClick={() => onOpen(entry)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onOpen(entry);
            }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Icon name={entry.type === 'directory' ? 'folder' : 'file'} className="size-4 shrink-0" />
              <span className="truncate text-(--vscode-foreground)">{entry.name}</span>
            </div>
            <div className="w-36 shrink-0 text-right whitespace-nowrap text-(--vscode-descriptionForeground)">
              {entry.modifiedAt === undefined ? '—' : formatDateTime(entry.modifiedAt)}
            </div>
            <div className="w-36 shrink-0 text-right whitespace-nowrap text-(--vscode-descriptionForeground)">
              {entry.createdAt === undefined ? '—' : formatDateTime(entry.createdAt)}
            </div>
            <div className="w-14 shrink-0 text-right whitespace-nowrap text-(--vscode-descriptionForeground)">
              {entry.size === undefined ? '—' : formatSize(entry.size)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
