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
type TableSnapshot = DatabaseTable & { settledQuery?: string; displayedPage?: number };

const initialQuery = JSON.stringify({ search: '', columns: {}, page: 0, revision: 0 });

function createColumn(
  column: DatabaseTable['columns'][number],
  columnIndex: number,
  filter: string,
  onFilterChange: (value: string) => void,
): TableColumn<DatabaseRow> {
  return {
    key: `column-${columnIndex}`,
    align: 'left',
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
          aria-label={`Filter ${column.name}`}
          placeholder="Filter..."
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
        />
      </div>
    ),
    headerClassName: 'min-w-44 bg-(--vscode-editor-background) px-3!',
    className: 'h-6 px-3! font-mono hover:bg-(--vscode-list-hoverBackground)',
    cell: (row) => {
      const value = row.values[columnIndex] ?? null;
      if (value === null || value === '') {
        return (
          <span className="text-xs italic text-(--vscode-descriptionForeground)">
            {value === null ? 'NULL' : 'empty'}
          </span>
        );
      }
      return (
        <span
          className={typeof value === 'number' ? 'text-(--vscode-debugTokenExpression-number)' : undefined}
          title={String(value)}
        >
          {String(value)}
        </span>
      );
    },
  };
}

function App() {
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const queryKey = JSON.stringify({ search, columns: columnFilters, page, revision });
  const request = useRef({ id: 0, key: initialQuery, page: 0 });
  const currentQuery = useRef(queryKey);
  currentQuery.current = queryKey;
  const state = useHostData<TableSnapshot, DatabaseTableFilterResult>((message, previous) => {
    if (
      message.type !== 'tableFilterResult' ||
      message.requestId !== request.current.id ||
      request.current.key !== currentQuery.current
    )
      return previous;
    if (message.error) {
      return previous.status === 'loaded'
        ? { ...previous, error: message.error, data: { ...previous.data, settledQuery: request.current.key } }
        : previous;
    }
    return message.data
      ? {
          status: 'loaded',
          data: { ...message.data, settledQuery: request.current.key, displayedPage: request.current.page },
        }
      : previous;
  });
  const name = state.status === 'loaded' ? state.data.name : (getRootData('name') ?? 'Database Table');
  const activeColumnCount = Object.values(columnFilters).filter((value) => value.trim()).length;
  const hasActiveFilters = Boolean(search.trim() || activeColumnCount);

  useEffect(() => {
    if (state.status !== 'loaded') return;
    if (queryKey === initialQuery && request.current.id === 0) return;
    const requestId = request.current.id + 1;
    request.current = { id: requestId, key: queryKey, page };
    const filters: DatabaseTableFilters = { search, columns: columnFilters, page };
    const timeout = window.setTimeout(() => {
      postToHost({ type: 'filterTable', requestId, filters });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [queryKey, search, columnFilters, page, state.status]);

  useEffect(() => {
    document.title = name;
  }, [name]);

  function clearFilters() {
    setSearch('');
    setColumnFilters({});
    setPage(0);
  }

  if (state.status !== 'loaded') {
    return (
      <main className="grid min-h-dvh place-items-center bg-(--vscode-editor-background) p-4 text-sm text-(--vscode-foreground)">
        {state.status === 'loading' ? (
          <Loading label="Reading table..." />
        ) : (
          <div className="flex max-w-lg flex-col items-center gap-3 text-center" role="alert">
            <Icon name="warning" size="2xl" variant="muted" />
            <p className="m-0 text-(--vscode-errorForeground)">{state.message}</p>
            <Button variant="secondary" prefix={<Icon name="refresh" />} onClick={() => postToHost({ type: 'ready' })}>
              Retry
            </Button>
          </div>
        )}
      </main>
    );
  }

  const table = state.data;
  const pending = (table.settledQuery ?? initialQuery) !== queryKey;
  const displayedPage = table.displayedPage ?? 0;
  const totalRows = table.filteredRowCount ?? table.rowCount;
  const pageCount = Math.max(1, Math.ceil(totalRows / databaseTablePageSize));
  const firstRow = displayedPage * databaseTablePageSize + 1;
  const lastRow = displayedPage * databaseTablePageSize + table.rows.length;
  const rows = table.rows.map((values, index) => ({ values, rowNumber: firstRow + index }));
  const columns: readonly TableColumn<DatabaseRow>[] = [
    ...table.columns.map((column, columnIndex) =>
      createColumn(column, columnIndex, columnFilters[column.name] ?? '', (value) => {
        setColumnFilters((filters) => {
          const next = { ...filters };
          if (value) next[column.name] = value;
          else delete next[column.name];
          return next;
        });
        setPage(0);
      }),
    ),
  ];

  return (
    <main className="flex h-dvh min-w-0 select-text flex-col overflow-hidden bg-(--vscode-editor-background) text-sm text-(--vscode-foreground)">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-(--vscode-panel-border) p-2">
        <div className="relative min-w-32 flex-1 sm:max-w-80">
          <Icon name="search" size="sm" variant="muted" className="pointer-events-none absolute inset-y-0 left-2" />
          <Input
            type="search"
            className="w-full pl-7"
            aria-label="Search rows"
            placeholder="Search rows..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            prefix={<Icon name="clear-all" />}
            title="Clear all filters"
            aria-label="Clear all filters"
            onClick={clearFilters}
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          <span role="status" className="text-xs text-(--vscode-descriptionForeground)">
            {pending ? 'Updating...' : ''}
          </span>
          <Button
            variant="ghost"
            prefix={<Icon name="refresh" className={pending ? 'animate-spin motion-reduce:animate-none' : undefined} />}
            title="Refresh data"
            aria-label="Refresh data"
            disabled={pending}
            onClick={() => setRevision((value) => value + 1)}
          />
        </div>
      </div>
      {state.error && (
        <div
          role="alert"
          className="flex shrink-0 items-start gap-2 border-b border-(--vscode-panel-border) bg-(--vscode-inputValidation-errorBackground) px-4 py-2 text-(--vscode-errorForeground)"
        >
          <Icon name="warning" />
          <span className="min-w-0 flex-1 wrap-break-word">{state.error}</span>
          <Button
            variant="ghost"
            prefix={<Icon name="refresh" size="sm" />}
            aria-label="Retry query"
            title="Retry query"
            disabled={pending}
            onClick={() => setRevision((value) => value + 1)}
          />
        </div>
      )}
      <section className="flex min-h-0 flex-1 flex-col" aria-label="Table data" aria-busy={pending}>
        {table.columns.length ? (
          <Table
            ariaLabel={`${name} data`}
            columns={columns}
            rows={rows}
            border
            rowKey={(row) => row.rowNumber}
            emptyMessage={
              <div className="flex flex-col items-center gap-2 py-10">
                <Icon name={hasActiveFilters ? 'search' : 'table'} size="2xl" variant="muted" />
                <span>{hasActiveFilters ? 'No matching rows' : 'This table is empty'}</span>
                {hasActiveFilters && (
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            }
            className="min-h-0 flex-1 border-y-0"
          />
        ) : (
          <div className="grid min-h-0 flex-1 place-items-center  text-(--vscode-descriptionForeground)">
            This table has no columns.
          </div>
        )}
      </section>
      <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-(--vscode-panel-border) px-2 py-1 text-xs text-(--vscode-descriptionForeground)">
        <span className="shrink-0 tabular-nums">
          {totalRows && table.rows.length
            ? `${firstRow.toLocaleString()}-${lastRow.toLocaleString()} of ${totalRows.toLocaleString()} rows`
            : '0 rows'}
        </span>
        {table.columnCount > table.columns.length && (
          <span>
            Showing {table.columns.length} of {table.columnCount} columns
          </span>
        )}
        <nav aria-label="Pagination" className="ml-auto flex shrink-0 items-center gap-1 tabular-nums">
          <Button
            variant="ghost"
            size="sm"
            title="Previous page"
            aria-label="Previous page"
            prefix={<Icon name="chevron-left" size="sm" />}
            disabled={pending || displayedPage === 0}
            onClick={() => setPage(displayedPage - 1)}
          />
          <span className="min-w-14 text-center">
            {displayedPage + 1} / {pageCount.toLocaleString()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            title="Next page"
            aria-label="Next page"
            prefix={<Icon name="chevron-right" size="sm" />}
            disabled={pending || displayedPage + 1 >= pageCount}
            onClick={() => setPage(displayedPage + 1)}
          />
        </nav>
      </footer>
    </main>
  );
}

mountWebview('root', <App />);
