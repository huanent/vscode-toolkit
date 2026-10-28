import { cn } from 'cn';
import type { Key, MouseEvent, ReactNode } from 'react';

export type DataListSortDirection = 'ascending' | 'descending';

export type DataListColumn<T> = {
  key: Key;
  header: ReactNode;
  cell: (entry: T, entryIndex: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
};

type DataListProps<T> = {
  ariaLabel: string;
  entries: readonly T[];
  columns: readonly DataListColumn<T>[];
  entryKey: (entry: T) => Key;
  entryContext?: (entry: T) => Record<string, unknown>;
  isSelected?: (entry: T) => boolean;
  isCut?: (entry: T) => boolean;
  onSelect?: (entry: T, event: MouseEvent<HTMLElement>) => void;
  onOpen?: (entry: T) => void;
  emptyMessage?: ReactNode;
  className?: string;
  /** Key of the column currently used for sorting. */
  sortColumnKey?: Key;
  sortDirection?: DataListSortDirection;
  /** Toggling the active column flips direction; another column starts ascending. */
  onSortChange?: (columnKey: Key, direction: DataListSortDirection) => void;
};

const alignmentClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

const justificationClasses = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
} as const;

/** Stacked ascending/descending triangles; the active direction is highlighted. */
function SortIndicator({ direction }: { direction: DataListSortDirection | null }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 16" className="h-3 w-2.5 shrink-0 text-(--vscode-descriptionForeground)">
      <path
        d="M6 1 10.5 6.5h-9Z"
        className={cn(
          'transition-opacity',
          direction === 'ascending'
            ? 'fill-current text-(--vscode-foreground)'
            : 'fill-current opacity-30 group-hover:opacity-70',
        )}
      />
      <path
        d="M6 15 10.5 9.5h-9Z"
        className={cn(
          'transition-opacity',
          direction === 'descending'
            ? 'fill-current text-(--vscode-foreground)'
            : 'fill-current opacity-30 group-hover:opacity-70',
        )}
      />
    </svg>
  );
}

export function DataList<T>({
  ariaLabel,
  entries,
  columns,
  entryKey,
  entryContext,
  isSelected,
  isCut,
  onSelect,
  onOpen,
  emptyMessage = 'No items.',
  className,
  sortColumnKey,
  sortDirection = 'ascending',
  onSortChange,
}: DataListProps<T>) {
  return (
    <div
      role={onSelect ? 'grid' : 'table'}
      aria-label={ariaLabel}
      aria-multiselectable={onSelect ? true : undefined}
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
          {columns.map((column) => {
            const sortable = column.sortable === true && onSortChange !== undefined;
            const active = sortable && column.key === sortColumnKey;
            return (
              <div
                key={column.key}
                role="columnheader"
                aria-sort={sortable ? (active ? sortDirection : 'none') : undefined}
                className={cn(
                  'min-w-0 whitespace-nowrap',
                  alignmentClasses[column.align ?? 'left'],
                  column.className,
                  column.headerClassName,
                )}
              >
                {sortable ? (
                  <button
                    type="button"
                    className={cn(
                      'group flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-sm outline-none transition-colors hover:text-(--vscode-foreground) focus-visible:outline-1 -outline-offset-1 focus-visible:outline-(--vscode-focusBorder)',
                      active && 'text-(--vscode-foreground)',
                      justificationClasses[column.align ?? 'left'],
                    )}
                    onClick={() =>
                      onSortChange(column.key, active && sortDirection === 'ascending' ? 'descending' : 'ascending')
                    }
                  >
                    <span className="min-w-0 truncate">{column.header}</span>
                    <SortIndicator direction={active ? sortDirection : null} />
                  </button>
                ) : (
                  column.header
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div role="rowgroup" className="min-w-max py-1">
        {entries.map((entry, entryIndex) => (
          <div
            key={entryKey(entry)}
            role="row"
            aria-selected={isSelected?.(entry)}
            data-vscode-context={entryContext ? JSON.stringify(entryContext(entry)) : undefined}
            tabIndex={onOpen ? 0 : undefined}
            className={cn(
              'mx-1 flex items-center gap-3 rounded px-3 py-1 text-sm outline-none transition-colors focus-visible:outline-1 -outline-offset-1 focus-visible:outline-(--vscode-focusBorder)',
              isSelected?.(entry)
                ? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)'
                : 'hover:bg-(--vscode-list-hoverBackground)',
              isCut?.(entry) && 'opacity-50',
              onOpen && 'cursor-pointer',
            )}
            onClick={
              onSelect
                ? (event) => {
                    if (!(event.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"]'))
                      onSelect(entry, event);
                  }
                : undefined
            }
            onDoubleClick={
              onOpen
                ? (event) => {
                    if (
                      !event.shiftKey &&
                      !event.ctrlKey &&
                      !event.metaKey &&
                      !(event.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"]')
                    )
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
                role={onSelect ? 'gridcell' : 'cell'}
                className={cn('min-w-0', alignmentClasses[column.align ?? 'left'], column.className)}
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
