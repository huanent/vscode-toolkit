import { useEffect, useRef, useState } from 'react';
import {
  databaseTablePageSize,
  type DatabaseCellValue,
  type DatabaseTable,
  type DatabaseTableFilterResult,
  type DatabaseTableFilters,
} from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Loading } from '@/webview/components/loading';
import { Table, type TableColumn } from '@/webview/components/table';
import { getRootData, postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

type DatabaseRow = { values: DatabaseCellValue[]; rowNumber: number };

function createColumn(
  column: DatabaseTable['columns'][number],
  columnIndex: number,
  filter: string,
  onFilterChange: (value: string) => void,
): TableColumn<DatabaseRow> {
  return {
    key: column.name,
    align: 'left',
    header: (
      <div className="grid gap-1 py-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{column.name}</span>
        </span>
        <Input
          type="search"
          aria-label={`Filter ${column.name}`}
          placeholder="Filter..."
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        />
      </div>
    ),
    headerClassName: 'min-w-36 max-w-80 bg-(--vscode-editor-background) text-left',
    className: 'h-6 max-w-80 font-mono',
    cell: (row) => {
      const value = row.values[columnIndex] ?? null;
      const displayValue = value === null ? 'NULL' : String(value);
      return (
        <span className={value === null ? 'italic text-(--vscode-descriptionForeground)' : ''} title={displayValue}>
          {displayValue}
        </span>
      );
    },
  };
}

function App() {
  const latestRequestId = useRef(0);
  const hasRequestedFilters = useRef(false);
  const state = useHostData<DatabaseTable, DatabaseTableFilterResult>((message, previous) => {
    if (message.type !== 'tableFilterResult' || message.requestId !== latestRequestId.current) return previous;
    if (message.error) {
      return previous.status === 'loaded' ? { ...previous, error: message.error } : previous;
    }
    return message.data ? { status: 'loaded', data: message.data } : previous;
  });
  const name = getRootData('name') ?? 'Database Table';
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const hasActiveFilters = Boolean(search.trim() || Object.values(columnFilters).some((filter) => filter.trim()));

  useEffect(() => {
    if (state.status !== 'loaded') return;
    const requestId = ++latestRequestId.current;
    if (!hasRequestedFilters.current && !hasActiveFilters && page === 0) return;
    const filters: DatabaseTableFilters = { search, columns: columnFilters, page };
    const timeout = window.setTimeout(() => {
      hasRequestedFilters.current = true;
      postToHost({ type: 'filterTable', requestId, filters });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search, columnFilters, page, state.status, hasActiveFilters]);

  useEffect(() => {
    document.title = name;
  }, [name]);

  if (state.status !== 'loaded') {
    return (
      <main className="grid min-h-dvh place-items-center bg-(--vscode-editor-background) p-4 text-(--vscode-foreground)">
        {state.status === 'loading' ? (
          <Loading label="Reading table..." />
        ) : (
          <p className="max-w-lg text-center text-(--vscode-errorForeground)" role="alert">
            {state.message}
          </p>
        )}
      </main>
    );
  }

  const table = state.data;
  const rows = table.rows.map((values, index) => ({ values, rowNumber: index + 1 }));
  const totalRows = table.filteredRowCount ?? table.rowCount;
  const pageCount = Math.max(1, Math.ceil(totalRows / databaseTablePageSize));
  const firstRow = page * databaseTablePageSize + 1;
  const lastRow = page * databaseTablePageSize + table.rows.length;
  const columns: readonly TableColumn<DatabaseRow>[] = [
    ...table.columns.map((column, columnIndex) =>
      createColumn(column, columnIndex, columnFilters[column.name] ?? '', (value) => {
        setColumnFilters((filters) => ({ ...filters, [column.name]: value }));
        setPage(0);
      }),
    ),
  ];

  return (
    <main className="flex h-dvh select-text flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-(--vscode-panel-border) px-3 py-2">
        <Icon name="search" size="sm" variant="muted" />
        <Input
          type="search"
          className="w-full sm:w-64"
          aria-label="Search rows"
          placeholder="Search rows..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        <span className="ml-auto  tabular-nums text-(--vscode-descriptionForeground)">
          {table.columnCount.toLocaleString()} columns
        </span>
      </div>
      {state.error && (
        <p className="shrink-0 px-3 py-1  text-(--vscode-errorForeground)" role="alert">
          {state.error}
        </p>
      )}
      {table.columns.length ? (
        <Table
          ariaLabel={`${name} data`}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.rowNumber}
          border
          emptyMessage={hasActiveFilters ? 'No matching rows.' : 'This table is empty.'}
          className="min-h-0 flex-1"
        />
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center  text-(--vscode-descriptionForeground)">
          This table has no columns.
        </div>
      )}
      <footer className="flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-(--vscode-panel-border) px-3 py-1  text-(--vscode-descriptionForeground)">
        <span className="shrink-0 tabular-nums">
          {totalRows
            ? `${firstRow.toLocaleString()}-${lastRow.toLocaleString()} of ${totalRows.toLocaleString()} ${hasActiveFilters ? 'matching rows' : 'rows'}`
            : `No ${hasActiveFilters ? 'matching rows' : 'rows'}`}
        </span>
        <div role="group" aria-label="Pagination" className="ml-auto flex shrink-0 items-center gap-1 tabular-nums">
          <Button
            variant="ghost"
            size="sm"
            title="Previous page"
            aria-label="Previous page"
            prefix={<Icon name="chevron-left" size="sm" />}
            disabled={page === 0}
            onClick={() => setPage((current) => current - 1)}
          />
          <span>
            {page + 1} / {pageCount}
          </span>
          <Button
            variant="ghost"
            size="sm"
            title="Next page"
            aria-label="Next page"
            prefix={<Icon name="chevron-right" size="sm" />}
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          />
        </div>
        {table.columnCount > table.columns.length && (
          <span className="text-right">Preview limited to {table.columns.length} columns</span>
        )}
      </footer>
    </main>
  );
}

mountWebview('root', <App />);
