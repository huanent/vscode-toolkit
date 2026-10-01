import type { DatabaseTable } from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Icon } from '@/webview/components/icons';
import { Loading } from '@/webview/components/loading';
import { getRootData, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

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
    </main>
  );
}

mountWebview('root', <App />);
