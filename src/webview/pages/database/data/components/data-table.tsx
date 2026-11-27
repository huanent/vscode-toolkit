import { cn } from 'cn';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  isDatabaseBooleanColumn,
  type DatabaseCellValue,
  type DatabaseCopyCellRequest,
  type DatabaseCopyCellResult,
  type DatabaseTable,
} from '@/features/database/protocol';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { Empty } from '@/webview/components/ui/empty';
import { Input } from '@/webview/components/ui/input';
import { Select } from '@/webview/components/ui/select';
import { postToHost } from '@/webview/utils/host-data';

type DataColumn = {
  key: string;
  header: ReactNode;
  headerClassName: string;
  className: string;
  cell: (values: DatabaseCellValue[]) => ReactNode;
  copyText?: (values: DatabaseCellValue[]) => string;
};

type CopiedCell = { row: DatabaseCellValue[]; columnKey: string };

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [actionsOverlap, setActionsOverlap] = useState(false);
  const copyRequestId = useRef(0);
  const pendingCopy = useRef<(CopiedCell & { requestId: number }) | undefined>(undefined);
  const [copiedCell, setCopiedCell] = useState<CopiedCell>();

  useEffect(() => {
    let timeout: number | undefined;
    function onCopyResult(event: MessageEvent<DatabaseCopyCellResult>) {
      const pending = pendingCopy.current;
      if (!pending || event.data?.type !== 'cellCopied' || event.data.requestId !== pending.requestId) return;
      pendingCopy.current = undefined;
      setCopiedCell(pending);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setCopiedCell(undefined), 1000);
    }
    window.addEventListener('message', onCopyResult);
    return () => {
      window.removeEventListener('message', onCopyResult);
      window.clearTimeout(timeout);
    };
  }, []);

  function copyCell(row: DatabaseCellValue[], columnKey: string, text: string) {
    const requestId = ++copyRequestId.current;
    pendingCopy.current = { row, columnKey, requestId };
    postToHost({ type: 'copyCell', requestId, text } satisfies DatabaseCopyCellRequest);
  }

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const tableElement = tableRef.current;
    if (!scroller || !tableElement) return;

    const updateOverlap = () => {
      setActionsOverlap(scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft > 1);
    };

    const observer = new ResizeObserver(updateOverlap);
    observer.observe(scroller);
    observer.observe(tableElement);
    scroller.addEventListener('scroll', updateOverlap, { passive: true });
    updateOverlap();

    return () => {
      observer.disconnect();
      scroller.removeEventListener('scroll', updateOverlap);
    };
  }, []);

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
        {isDatabaseBooleanColumn(column) ? (
          <Select
            className="w-full"
            ariaLabel={`Filter ${column.name}`}
            value={filters[column.name] ?? ''}
            options={[
              { value: '', label: 'All values' },
              { value: 'true', label: 'true' },
              { value: 'false', label: 'false' },
              { value: 'null', label: 'NULL' },
            ]}
            disabled={mutationPending}
            onValueChange={(value) => onFilterChange(column.name, value)}
          />
        ) : (
          <Input
            type="search"
            className="w-full"
            aria-label={`Filter ${column.name}`}
            placeholder="Contains... / NULL"
            title="Case-insensitive text match. Enter NULL to match null values only."
            value={filters[column.name] ?? ''}
            disabled={mutationPending}
            onChange={(event) => onFilterChange(column.name, event.target.value)}
          />
        )}
      </div>
    ),
    headerClassName: 'min-w-44 bg-(--vscode-editor-background) px-3!',
    className: 'relative h-6 cursor-default px-3! font-mono hover:bg-(--vscode-list-hoverBackground)',
    copyText: (values) => String(values[columnIndex] ?? 'NULL'),
    cell: (values) => {
      const value = values[columnIndex] ?? null;
      if (value === null || value === '')
        return (
          <span className="text-xs italic text-(--vscode-descriptionForeground)">
            {value === null ? 'NULL' : 'empty'}
          </span>
        );
      const booleanValue = isDatabaseBooleanColumn(column) && /^(?:0|1|true|false)$/i.test(String(value));
      const display = booleanValue
        ? /^(?:1|true)$/i.test(String(value))
          ? 'true'
          : 'false'
        : String(value);
      return (
        <span
          title={display}
          className={
            booleanValue
              ? 'text-(--vscode-debugTokenExpression-boolean)'
              : typeof value === 'number'
                ? 'text-(--vscode-debugTokenExpression-number)'
                : undefined
          }
        >
          {display}
        </span>
      );
    },
  }));
  columns.push({
    key: 'actions',
    header: <span className="sr-only">Row actions</span>,
    headerClassName: 'min-w-16! w-16 border-(--vscode-panel-border) bg-(--vscode-editor-background)',
    className: cn(
      'sticky right-0 z-0 min-w-16 w-16 border-(--vscode-panel-border) bg-(--vscode-editor-background) text-center',
      actionsOverlap &&
        'before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:border-l before:border-(--vscode-panel-border)',
    ),
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
    <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto -mb-px text-sm">
      <table ref={tableRef} className="w-max min-w-full border-separate border-spacing-0" aria-label={`${table.name} data`}>
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
          {table.rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="p-8">
                <Empty
                  icon="table"
                  title={table.rowCount ? 'No matching rows' : 'No rows'}
                  description={table.rowCount ? 'Adjust or clear the filters to see more data.' : 'This table is empty.'}
                />
              </td>
            </tr>
          )}
          {table.rows.map((values, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map(({ key, className, cell, copyText }) => {
                const copied = copiedCell?.row === values && copiedCell.columnKey === key;
                return (
                  <td
                    key={key}
                    className={cn(
                      'max-w-80 overflow-hidden border-r border-b border-(--vscode-panel-border) px-2 py-1 text-left text-ellipsis whitespace-nowrap',
                      className,
                    )}
                    onMouseDown={
                      copyText
                        ? (event) => {
                            if (event.button === 0 && event.detail > 1) event.preventDefault();
                          }
                        : undefined
                    }
                    onDoubleClick={copyText ? () => copyCell(values, key, copyText(values)) : undefined}
                  >
                    {cell(values)}
                    {copied && (
                      <span
                        role="status"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 bg-(--vscode-editor-background) font-sans text-xs text-(--vscode-foreground)"
                      >
                        <Icon name="check" size="sm" />
                        Copied
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
