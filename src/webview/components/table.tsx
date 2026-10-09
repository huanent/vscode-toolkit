import { cn } from 'cn';
import type { Key, ReactNode } from 'react';

export type TableColumn<T> = {
  key: Key;
  header: ReactNode;
  cell?: (row: T, rowIndex: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
};

type TableProps<T> = {
  ariaLabel: string;
  columns: readonly TableColumn<T>[];
  rows: readonly T[];
  border?: boolean;
  emptyMessage?: ReactNode;
  rowKey?: (row: T, rowIndex: number) => Key;
  onRowClick?: (row: T, rowIndex: number) => void;
  className?: string;
};

const alignmentClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

export function Table<T>({
  ariaLabel,
  columns,
  rows,
  border = false,
  emptyMessage = 'No rows returned.',
  rowKey,
  onRowClick,
  className,
}: TableProps<T>) {
  return (
    <div className={cn('min-w-0 overflow-auto', border && 'border border-(--vscode-panel-border)', className)}>
      <table className="w-max min-w-full border-separate border-spacing-0 text-sm" aria-label={ariaLabel}>
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'h-7 min-w-36 border-b border-(--vscode-panel-border) bg-(--vscode-editor-background) px-2 text-left font-medium text-(--vscode-descriptionForeground)',
                  border && 'border-r',
                  alignmentClasses[column.align ?? 'left'],
                  column.headerClassName,
                )}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowKey?.(row, rowIndex) ?? rowIndex}
              className={cn(
                onRowClick &&
                  'cursor-pointer hover:bg-(--vscode-list-hoverBackground) hover:text-(--vscode-list-hoverForeground)',
              )}
              onClick={onRowClick ? () => onRowClick(row, rowIndex) : undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'h-7 max-w-80 overflow-hidden px-2 text-ellipsis whitespace-nowrap',
                    border && 'border-b border-r border-(--vscode-panel-border)',
                    alignmentClasses[column.align ?? 'left'],
                    column.className,
                  )}
                >
                  {column.cell ? column.cell(row, rowIndex) : null}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td
                colSpan={Math.max(1, columns.length)}
                className="h-14 px-3 text-center text-(--vscode-descriptionForeground)"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
