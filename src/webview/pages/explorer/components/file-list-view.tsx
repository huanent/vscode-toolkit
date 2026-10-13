import { cn } from 'cn';
import type { ReactNode } from 'react';
import type { ExplorerEntry } from '@/features/explorer/protocol';
import { Icon } from '@/webview/components/icons';
import { formatDateTime, formatSize } from '@/webview/utils/format';

type FileListViewProps = {
  entries: readonly ExplorerEntry[];
  onOpen: (entry: ExplorerEntry) => void;
};

export function FileListView({ entries, onOpen }: FileListViewProps) {
  return (
    <table aria-label="Files" className="w-full border-separate border-spacing-0 text-left">
      <thead className="sticky top-0 z-10 bg-(--vscode-editor-background)">
        <tr>
          <HeaderCell className="w-full">
            <div className="flex items-center gap-1">
              <Icon name="file" className="invisible" />
              <span>Name</span>
            </div>
          </HeaderCell>
          <HeaderCell>Modified</HeaderCell>
          <HeaderCell>Created</HeaderCell>
          <HeaderCell className="text-right">Size</HeaderCell>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr
            key={entry.id}
            tabIndex={0}
            className="cursor-pointer hover:bg-(--vscode-list-hoverBackground)"
            onClick={() => onOpen(entry)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onOpen(entry);
            }}
          >
            <td className="max-w-0 px-2 py-1">
              <div className="flex min-w-0 items-center gap-1">
                <Icon name={entry.type === 'directory' ? 'folder' : 'file'} />
                <span className="truncate">{entry.name}</span>
              </div>
            </td>
            <DataCell>{entry.modifiedAt === undefined ? '—' : formatDateTime(entry.modifiedAt)}</DataCell>
            <DataCell>{entry.createdAt === undefined ? '—' : formatDateTime(entry.createdAt)}</DataCell>
            <DataCell className="text-right">{entry.size === undefined ? '—' : formatSize(entry.size)}</DataCell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type HeaderCellProps = {
  className?: string;
  children: ReactNode;
};

function HeaderCell({ className, children }: HeaderCellProps) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-(--vscode-panel-border) px-2 py-1 font-medium whitespace-nowrap text-(--vscode-descriptionForeground)',
        className,
      )}
    >
      {children}
    </th>
  );
}

type DataCellProps = {
  className?: string;
  children: string;
};

function DataCell({ className, children }: DataCellProps) {
  return (
    <td className={cn('px-2 py-1 whitespace-nowrap text-(--vscode-descriptionForeground)', className)}>{children}</td>
  );
}
