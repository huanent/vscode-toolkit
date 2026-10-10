import { useEffect, useRef, useState } from 'react';
import type {
  DatabaseCellValue,
  DatabaseTable,
  DatabaseTableFilterResult,
  DatabaseTableFilters,
} from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Loading } from '@/webview/components/loading';
import { Table, type TableColumn } from '@/webview/components/table';
import { getRootData, postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

type DatabaseRow = { values: DatabaseCellValue[]; rowNumber: number };

const rowNumberColumn: TableColumn<DatabaseRow> = {
  key: 'row-number',
  header: '#',
  align: 'right',
  headerClassName:
    'sticky left-0 z-30 w-12 min-w-12 max-w-12 bg-(--vscode-editor-background) text-(--vscode-descriptionForeground)',
  className:
    'sticky left-0 z-10 w-12 min-w-12 max-w-12 bg-(--vscode-editor-background) tabular-nums text-(--vscode-descriptionForeground)',
  cell: (row) => row.rowNumber,
};

function createColumn(
  column: DatabaseTable['columns'][number],
  columnIndex: number,
  filter: string,
  onFilterChange: (value: string) => void,
): TableColumn<DatabaseRow> {
  const typeDescription = column.type || 'Any';
  return {
    key: column.name,
    align: 'left',
    header: (
      <div className="grid gap-1 py-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{column.name}</span>
          {column.primaryKey && (
            <span className="shrink-0 text-(--vscode-descriptionForeground)" title="Primary key">
              PK
            </span>
          )}
        </span>
        <span className="block truncate text-(--vscode-descriptionForeground)">
          {typeDescription}
          {column.notNull ? ' · NOT NULL' : ''}
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
    className: 'h-7 max-w-80 font-mono',
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
  const hasActiveFilters = Boolean(search.trim() || Object.values(columnFilters).some((filter) => filter.trim()));

  useEffect(() => {
    if (state.status !== 'loaded') return;
    const requestId = ++latestRequestId.current;
    if (!hasRequestedFilters.current && !hasActiveFilters) return;
    const filters: DatabaseTableFilters = { search, columns: columnFilters };
    const timeout = window.setTimeout(() => {
      hasRequestedFilters.current = true;
      postToHost({ type: 'filterTable', requestId, filters });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search, columnFilters, state.status, hasActiveFilters]);

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
  const columns: readonly TableColumn<DatabaseRow>[] = [
    rowNumberColumn,
    ...table.columns.map((column, columnIndex) =>
      createColumn(column, columnIndex, columnFilters[column.name] ?? '', (value) =>
        setColumnFilters((filters) => ({ ...filters, [column.name]: value })),
      ),
    ),
  ];

  return (
    <main className="flex h-dvh select-text flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-(--vscode-panel-border) px-3">
        <Icon name="table" variant="muted" size="sm" />
        <h1 className="min-w-0 truncate text-sm font-semibold" title={name}>
          {name}
        </h1>
        <span className="ml-auto shrink-0 text-xs tabular-nums text-(--vscode-descriptionForeground)">
          {table.rowCount.toLocaleString()} rows
        </span>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-(--vscode-panel-border) px-3 py-2">
        <Icon name="search" size="sm" variant="muted" />
        <Input
          type="search"
          className="w-full sm:w-64"
          aria-label="Search rows"
          placeholder="Search rows..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span className="ml-auto text-xs tabular-nums text-(--vscode-descriptionForeground)">
          {table.columnCount.toLocaleString()} columns
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {state.error && (
          <p className="px-3 py-1 text-xs text-(--vscode-errorForeground)" role="alert">
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
            className="min-w-full"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-(--vscode-descriptionForeground)">
            This table has no columns.
          </div>
        )}
      </div>
      <footer className="flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-(--vscode-panel-border) px-3 py-1 text-xs text-(--vscode-descriptionForeground)">
        <span className="shrink-0 tabular-nums">
          {hasActiveFilters
            ? `${(table.filteredRowCount ?? rows.length).toLocaleString()} matching rows${
                (table.filteredRowCount ?? rows.length) > rows.length ? ` (${rows.length.toLocaleString()} shown)` : ''
              }`
            : `${table.rows.length.toLocaleString()} of ${table.rowCount.toLocaleString()} rows`}
        </span>
        {((hasActiveFilters ? (table.filteredRowCount ?? 0) > table.rows.length : table.rowCount > table.rows.length) ||
          table.columnCount > table.columns.length) && (
          <span className="text-right">
            Preview limited to {table.rows.length} rows and {table.columns.length} columns
          </span>
        )}
      </footer>
    </main>
  );
}

mountWebview('root', <App />);
