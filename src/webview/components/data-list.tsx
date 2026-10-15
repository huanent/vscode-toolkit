import { cn } from 'cn';
import type { Key, ReactNode } from 'react';

export type DataListColumn<T> = {
  key: Key;
  header: ReactNode;
  cell: (entry: T, entryIndex: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
};

type DataListProps<T> = {
  ariaLabel: string;
  entries: readonly T[];
  columns: readonly DataListColumn<T>[];
  entryKey: (entry: T) => Key;
  entryContext?: (entry: T) => Record<string, unknown>;
  onOpen?: (entry: T) => void;
  emptyMessage?: ReactNode;
  className?: string;
};

const alignmentClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

export function DataList<T>({
  ariaLabel,
  entries,
  columns,
  entryKey,
  entryContext,
  onOpen,
  emptyMessage = 'No items.',
  className,
}: DataListProps<T>) {
  return (
    <div
      role="table"
      aria-label={ariaLabel}
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-auto bg-(--vscode-editor-background) text-sm select-none',
        className,
      )}
    >
      <div className="sticky top-0 z-10 min-w-max bg-(--vscode-editor-background)" role="rowgroup">
        <div
          role="row"
          className="flex items-center gap-3 border-b border-(--vscode-panel-border) px-4 py-1.5 font-medium text-(--vscode-descriptionForeground)"
        >
          {columns.map((column) => (
            <div
              key={column.key}
              role="columnheader"
              className={cn(
                'min-w-0 whitespace-nowrap',
                alignmentClasses[column.align ?? 'left'],
                column.className,
                column.headerClassName,
              )}
            >
              {column.header}
            </div>
          ))}
        </div>
      </div>
      <div role="rowgroup" className="min-w-max py-1">
        {entries.map((entry, entryIndex) => (
          <div
            key={entryKey(entry)}
            role="row"
            data-vscode-context={entryContext ? JSON.stringify(entryContext(entry)) : undefined}
            tabIndex={onOpen ? 0 : undefined}
            className={cn(
              'mx-1 flex items-center gap-3 rounded px-3 py-1 text-sm outline-none transition-colors hover:bg-(--vscode-list-hoverBackground) focus-visible:outline-1 -outline-offset-1 focus-visible:outline-(--vscode-focusBorder)',
              onOpen && 'cursor-pointer',
            )}
            onDoubleClick={
              onOpen
                ? (event) => {
                    if (!(event.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"]'))
                      onOpen(entry);
                  }
                : undefined
            }
            onKeyDown={
              onOpen
                ? (event) => {
                    if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(entry);
                  }
                : undefined
            }
          >
            {columns.map((column) => (
              <div
                key={column.key}
                role="cell"
                className={cn(
                  'min-w-0 text-(--vscode-foreground)',
                  alignmentClasses[column.align ?? 'left'],
                  column.className,
                )}
              >
                {column.cell(entry, entryIndex)}
              </div>
            ))}
          </div>
        ))}
        {!entries.length && (
          <div role="row" className="px-4 py-4 text-center text-(--vscode-descriptionForeground)">
            <div role="cell" aria-colspan={Math.max(1, columns.length)}>
              {emptyMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
