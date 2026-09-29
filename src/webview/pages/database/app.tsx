import { useEffect, useState } from 'react';
import { cn } from 'cn';
import type { DatabaseDocument, DatabaseTable } from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Icon } from '@/webview/components/icons';
import { Loading } from '@/webview/components/loading';
import { getRootData, postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function App() {
  const state = useHostData<DatabaseDocument>();
  const name = getRootData('name') ?? 'SQLite Database';
  const [activeTableName, setActiveTableName] = useState<string>();

  useEffect(() => {
    document.title = name;
  }, [name]);

  if (state.status === 'loaded') {
    const activeTable = state.data.tables.find((table) => table.name === activeTableName) ?? state.data.tables[0];

    return (
      <main className="flex h-dvh select-text flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
        <header className="flex h-10 shrink-0 items-center gap-2 border-b border-(--vscode-panel-border) px-3">
          <Icon name="database" variant="muted" />
          <span className="shrink-0 text-xs font-semibold">SQLite</span>
          <span className="text-xs text-(--vscode-descriptionForeground)">/</span>
          <span className="min-w-0 truncate text-xs text-(--vscode-descriptionForeground)" title={name}>
            {name}
          </span>
          <span className="ml-auto shrink-0 text-xs text-(--vscode-descriptionForeground)">
            {state.data.tables.length} tables
          </span>
          <button
            type="button"
            aria-label="Open SQL Editor"
            title="Open SQL Editor"
            onClick={() => postToHost({ type: 'openSqlEditor', tableName: activeTable?.name })}
            className="grid size-7 shrink-0 place-items-center hover:bg-(--vscode-toolbar-hoverBackground) focus-visible:outline-1 focus-visible:outline-(--vscode-focusBorder)"
          >
            <Icon name="code" size="sm" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 max-sm:flex-col">
          <aside className="flex w-56 shrink-0 flex-col border-r border-(--vscode-panel-border) max-sm:h-48 max-sm:w-full max-sm:border-r-0 max-sm:border-b">
            <div className="flex h-9 shrink-0 items-center justify-between px-3">
              <h2 className="text-xs font-semibold text-(--vscode-descriptionForeground)">Tables</h2>
              <span className="text-xs tabular-nums text-(--vscode-descriptionForeground)">
                {state.data.tables.length}
              </span>
            </div>
            <nav aria-label="Database tables" className="min-h-0 flex-1 overflow-auto px-2 pb-2">
              {state.data.tables.map((table) => {
                const selected = table.name === activeTable?.name;
                return (
                  <button
                    key={table.name}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActiveTableName(table.name)}
                    className={cn(
                      'flex h-8 w-full min-w-0 items-center gap-2 px-2 text-left text-xs',
                      selected
                        ? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)'
                        : 'text-(--vscode-foreground) hover:bg-(--vscode-list-hoverBackground)',
                    )}
                  >
                    <Icon name="table" variant={selected ? 'default' : 'muted'} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{table.name}</span>
                    <span className="shrink-0 tabular-nums text-(--vscode-descriptionForeground)">
                      {table.rowCount}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section aria-label="Table data" className="flex min-h-0 min-w-0 flex-1 flex-col">
            {activeTable ? <TableView table={activeTable} /> : <EmptyDatabase />}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-(--vscode-editor-background) p-4 text-(--vscode-foreground)">
      {state.status === 'loading' ? (
        <Loading label="Reading SQLite database..." />
      ) : (
        <p className="max-w-lg text-center text-(--vscode-errorForeground)" role="alert">
          {state.message}
        </p>
      )}
    </main>
  );
}

function TableView({ table }: { table: DatabaseTable }) {
  return (
    <>
      <div className="flex min-h-14 shrink-0 items-center gap-4 border-b border-(--vscode-panel-border) px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold" title={table.name}>
            {table.name}
          </h1>
          <p className="text-xs text-(--vscode-descriptionForeground)">
            {table.columnCount} columns · {table.rowCount} rows
          </p>
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-(--vscode-descriptionForeground)">
          <Icon name="table" size="sm" />
          Table data
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {table.columns.length ? (
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 h-10 min-w-12 border-r border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background) px-2 text-right font-normal text-(--vscode-descriptionForeground)">
                  #
                </th>
                {table.columns.map((column) => (
                  <th
                    key={column.name}
                    className="h-10 min-w-36 max-w-80 border-r border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background) px-2 text-left font-normal"
                    title={`${column.name}${column.type ? ` (${column.type})` : ''}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{column.name}</span>
                      {column.primaryKey && (
                        <span className="shrink-0 text-(--vscode-descriptionForeground)" title="Primary key">
                          PK
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-(--vscode-descriptionForeground)">
                      {column.type || 'Any'}
                      {column.notNull ? ' · NOT NULL' : ''}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <th className="sticky left-0 z-10 h-7 min-w-12 border-r border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background) px-2 text-right font-normal tabular-nums text-(--vscode-descriptionForeground)">
                    {rowIndex + 1}
                  </th>
                  {table.columns.map((column, columnIndex) => {
                    const value = row[columnIndex] ?? null;
                    const displayValue = value === null ? 'NULL' : String(value);
                    return (
                      <td
                        key={column.name}
                        className="h-7 max-w-80 overflow-hidden border-r border-b border-(--vscode-panel-border) px-2 font-mono text-ellipsis whitespace-nowrap"
                        title={displayValue}
                      >
                        <span className={value === null ? 'italic text-(--vscode-descriptionForeground)' : ''}>
                          {displayValue}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!table.rows.length && (
                <tr>
                  <td
                    colSpan={table.columns.length + 1}
                    className="h-16 border-b border-(--vscode-panel-border) text-center text-(--vscode-descriptionForeground)"
                  >
                    This table is empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
    </>
  );
}

function EmptyDatabase() {
  return (
    <div className="grid min-h-full place-items-center px-4 text-center">
      <div className="grid justify-items-center">
        <Icon name="database" size="2xl" variant="muted" className="mb-3" />
        <h1 className="text-sm font-semibold">No tables found</h1>
        <p className="mt-1 text-xs text-(--vscode-descriptionForeground)">
          This SQLite database contains no user tables.
        </p>
      </div>
    </div>
  );
}

mountWebview('root', <App />);
