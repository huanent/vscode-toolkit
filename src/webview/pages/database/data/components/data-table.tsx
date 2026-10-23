import { cn } from 'cn';
import type { ReactNode } from 'react';
import type { DatabaseCellValue, DatabaseTable } from '@/features/database/protocol';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';

type DataColumn = {
  key: string;
  header: ReactNode;
  headerClassName: string;
  className: string;
  cell: (values: DatabaseCellValue[]) => ReactNode;
};

type DataTableProps = {
  table: DatabaseTable;
  filters: Record<string, string>;
  disabled: boolean;
  mutationPending: boolean;
  onFilterChange: (name: string, value: string) => void;
  onEdit: (original: Record<string, DatabaseCellValue>) => void;
  onDelete: (original: Record<string, DatabaseCellValue>) => void;
};

export function DataTable({
  table,
  filters,
  disabled,
  mutationPending,
  onFilterChange,
  onEdit,
  onDelete,
}: DataTableProps) {
  const primaryKeys = table.columns.filter((column) => column.primaryKey);
  const canIdentify =
    table.columnCount === table.columns.length &&
    primaryKeys.length > 0 &&
    primaryKeys.every((column) => !column.readOnly && !/date|time|year|float|double/i.test(column.type));
  const columns: DataColumn[] = table.columns.map((column, columnIndex) => ({
    key: `column-${columnIndex}`,
    header: (
      <div className="grid gap-1 py-1">
        <div className="flex min-w-0 items-center gap-2">
          {column.primaryKey && <Icon name="key" size="sm" className="text-(--vscode-symbolIcon-keywordForeground)" />}
          <span className="max-w-64 truncate font-medium text-(--vscode-foreground)" title={column.name}>
            {column.name}
          </span>
          <span className="ml-auto max-w-32 truncate font-mono text-xs font-normal" title={column.type}>
            {column.type || 'unknown'}
          </span>
        </div>
        <Input
          type="search"
          className="w-full"
          aria-label={`Filter ${column.name}`}
          placeholder="Filter..."
          value={filters[column.name] ?? ''}
          disabled={mutationPending}
          onChange={(event) => onFilterChange(column.name, event.target.value)}
        />
      </div>
    ),
    headerClassName: 'min-w-44 bg-(--vscode-editor-background) px-3!',
    className: 'h-6 px-3! font-mono hover:bg-(--vscode-list-hoverBackground)',
    cell: (values) => {
      const value = values[columnIndex] ?? null;
      if (value === null || value === '')
        return (
          <span className="text-xs italic text-(--vscode-descriptionForeground)">
            {value === null ? 'NULL' : 'empty'}
          </span>
        );
      return (
        <span
          title={String(value)}
          className={typeof value === 'number' ? 'text-(--vscode-debugTokenExpression-number)' : undefined}
        >
          {String(value)}
        </span>
      );
    },
  }));
  columns.push({
    key: 'actions',
    header: <span className="sr-only">Row actions</span>,
    headerClassName: 'min-w-16! w-16 border-(--vscode-panel-border) bg-(--vscode-editor-background)',
    className:
      'sticky right-0 z-0 min-w-16 w-16 border-(--vscode-panel-border) bg-(--vscode-editor-background) text-center',
    cell: (values) => {
      const original = Object.fromEntries(table.columns.map((column, index) => [column.name, values[index] ?? null]));
      const canMutate =
        canIdentify &&
        primaryKeys.every((column) => {
          const value = original[column.name];
          return (
            value !== null && !(typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value))
          );
        });
      const unavailable = 'A complete, safely represented primary key is required';
      return (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            prefix={<Icon name="edit" size="sm" />}
            aria-label="Edit row"
            title={canMutate ? 'Edit row' : unavailable}
            disabled={disabled || !canMutate}
            onClick={() => onEdit(original)}
          />
          <Button
            variant="ghost"
            size="sm"
            prefix={<Icon name="trash" size="sm" />}
            aria-label="Delete row"
            title={canMutate ? 'Delete row' : unavailable}
            disabled={disabled || !canMutate}
            onClick={() => onDelete(original)}
          />
        </div>
      );
    },
  });
  return (
    <div tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-auto -mb-px text-sm">
      <table className="w-max min-w-full border-separate border-spacing-0" aria-label={`${table.name} data`}>
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'min-w-36 border-r border-b border-(--vscode-panel-border) px-2 py-1 text-left font-medium text-(--vscode-descriptionForeground)',
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
          {table.rows.map((values, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    'max-w-80 overflow-hidden border-r border-b border-(--vscode-panel-border) px-2 py-1 text-left text-ellipsis whitespace-nowrap',
                    column.className,
                  )}
                >
                  {column.cell(values)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
