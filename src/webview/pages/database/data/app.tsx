import { useDeferredValue, useEffect, useState } from 'react';
import type { DatabaseCellValue, DatabaseTable } from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Loading } from '@/webview/components/loading';
import { Table, type TableColumn } from '@/webview/components/table';
import { getRootData, useHostData } from '@/webview/utils/host-data';
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

function createColumn(column: DatabaseTable['columns'][number], columnIndex: number): TableColumn<DatabaseRow> {
  const typeDescription = column.type || 'Any';
  return {
    key: column.name,
    align: 'left',
    header: (
      <>
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
      </>
    ),
    headerClassName: 'h-10 min-w-36 max-w-80 bg-(--vscode-editor-background) text-left',
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
  const state = useHostData<DatabaseTable>();
  const name = getRootData('name') ?? 'Database Table';
  const [search, setSearch] = useState('');
  const query = useDeferredValue(search.trim().toLowerCase());
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
  const rows = table.rows
    .map((values, index) => ({ values, rowNumber: index + 1 }))
    .filter(
      (row) =>
        !query || row.values.some((value) => (value === null ? 'NULL' : String(value)).toLowerCase().includes(query)),
    );
  const columns: readonly TableColumn<DatabaseRow>[] = [
    rowNumberColumn,
    ...table.columns.map((column, columnIndex) => createColumn(column, columnIndex)),
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
          aria-label="Search loaded rows"
          placeholder="Search loaded rows..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span className="ml-auto text-xs tabular-nums text-(--vscode-descriptionForeground)">
          {table.columnCount.toLocaleString()} columns
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {table.columns.length ? (
          <Table
            ariaLabel={`${name} data`}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.rowNumber}
            border
            emptyMessage={query ? 'No matching rows in this preview.' : 'This table is empty.'}
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
          {query
            ? `${rows.length.toLocaleString()} matches in ${table.rows.length.toLocaleString()} loaded rows`
            : `${table.rows.length.toLocaleString()} of ${table.rowCount.toLocaleString()} rows`}
        </span>
        {(table.rowCount > table.rows.length || table.columnCount > table.columns.length) && (
          <span className="text-right">
            Preview limited to {table.rows.length} rows and {table.columns.length} columns
          </span>
        )}
      </footer>
    </main>
  );
}

mountWebview('root', <App />);
