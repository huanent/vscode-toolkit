import type { DatabaseTable } from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Icon } from '@/webview/components/icons';
import { Loading } from '@/webview/components/loading';
import { Table, type TableColumn } from '@/webview/components/table';
import { getRootData, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

type DatabaseRow = import('@/features/database/protocol').DatabaseCellValue[];

const rowNumberColumn: TableColumn<DatabaseRow> = {
  key: 'row-number',
  header: '#',
  width: '3rem',
  align: 'right',
  headerClassName: 'sticky left-0 z-30 min-w-12 bg-(--vscode-editor-background) text-(--vscode-descriptionForeground)',
  className:
    'sticky left-0 z-10 min-w-12 bg-(--vscode-editor-background) tabular-nums text-(--vscode-descriptionForeground)',
  cell: (_row, rowIndex) => rowIndex + 1,
};

function createColumn(column: DatabaseTable['columns'][number], columnIndex: number): TableColumn<DatabaseRow> {
  const typeDescription = column.type || 'Any';
  return {
    key: column.name,
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
    width: '9rem',
    headerClassName: 'h-10 min-w-36 max-w-80 text-left',
    className: 'h-7 max-w-80 font-mono',
    cell: (row) => {
      const value = row[columnIndex] ?? null;
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
  const name = getRootData('name') ?? 'SQLite Table';

  if (state.status !== 'loaded') {
    return (
      <main className="grid min-h-dvh place-items-center bg-(--vscode-editor-background) p-4 text-(--vscode-foreground)">
        {state.status === 'loading' ? (
          <Loading label="Reading SQLite table..." />
        ) : (
          <p className="max-w-lg text-center text-(--vscode-errorForeground)" role="alert">
            {state.message}
          </p>
        )}
      </main>
    );
  }

  const table = state.data;
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
        <span className="ml-auto shrink-0 text-xs text-(--vscode-descriptionForeground)">{table.rowCount} rows</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {table.columns.length ? (
          <Table
            ariaLabel={`${name} data`}
            columns={columns}
            rows={table.rows}
            border
            emptyMessage="This table is empty."
            className="min-w-full"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-(--vscode-descriptionForeground)">
            This table has no columns.
          </div>
        )}
      </div>
      <footer className="flex min-h-8 shrink-0 items-center justify-between gap-4 border-t border-(--vscode-panel-border) px-3 text-xs text-(--vscode-descriptionForeground)">
        <span className="shrink-0 tabular-nums">
          {table.rows.length} of {table.rowCount} rows
        </span>
        {(table.rowCount > table.rows.length || table.columnCount > table.columns.length) && (
          <span className="truncate text-right">
            Preview limited to {table.rows.length} rows and {table.columns.length} columns
          </span>
        )}
      </footer>
    </main>
  );
}

mountWebview('root', <App />);
