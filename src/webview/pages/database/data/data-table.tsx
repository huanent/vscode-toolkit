import type { DatabaseCellValue, DatabaseTable } from '@/features/database/protocol';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Table, type TableColumn } from '@/webview/components/table';

type DatabaseRow = { values: DatabaseCellValue[]; rowIndex: number };
type DataTableProps = {
  table: DatabaseTable;
  filters: Record<string, string>;
  hasActiveFilters: boolean;
  disabled: boolean;
  mutationPending: boolean;
  onFilterChange: (name: string, value: string) => void;
  onClearFilters: () => void;
  onEdit: (original: Record<string, DatabaseCellValue>) => void;
  onDelete: (original: Record<string, DatabaseCellValue>) => void;
};

export function DataTable({
  table,
  filters,
  hasActiveFilters,
  disabled,
  mutationPending,
  onFilterChange,
  onClearFilters,
  onEdit,
  onDelete,
}: DataTableProps) {
  const primaryKeys = table.columns.filter((column) => column.primaryKey);
  const canIdentify =
    table.columnCount === table.columns.length &&
    primaryKeys.length > 0 &&
    primaryKeys.every((column) => !column.readOnly && !/date|time|year|float|double/i.test(column.type));
  const columns: TableColumn<DatabaseRow>[] = table.columns.map((column, columnIndex) => ({
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
    cell: (row) => {
      const value = row.values[columnIndex] ?? null;
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
    headerClassName: 'min-w-16! w-16 border-l border-(--vscode-panel-border) bg-(--vscode-editor-background)',
    className:
      'sticky right-0 z-0 min-w-16 w-16 border-l border-(--vscode-panel-border) bg-(--vscode-editor-background) text-center',
    cell: (row) => {
      const original = Object.fromEntries(
        table.columns.map((column, index) => [column.name, row.values[index] ?? null]),
      );
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
    <Table
      ariaLabel={`${table.name} data`}
      columns={columns}
      rows={table.rows.map((values, rowIndex) => ({ values, rowIndex }))}
      rowKey={(row) => row.rowIndex}
      border
      className="min-h-0 flex-1 border-y-0"
      emptyMessage={
        <div className="flex flex-col items-center gap-2 py-10">
          <Icon name={hasActiveFilters ? 'search' : 'table'} size="2xl" variant="muted" />
          <span>{hasActiveFilters ? 'No matching rows' : 'This table is empty'}</span>
          {hasActiveFilters && (
            <Button variant="secondary" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      }
    />
  );
}
