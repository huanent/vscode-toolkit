import { useEffect } from 'react';
import type { DatabaseDocument } from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Icon } from '@/webview/components/icons';
import { Loading } from '@/webview/components/loading';
import { getRootData, postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function App() {
  const state = useHostData<DatabaseDocument>();
  const name = getRootData('name') ?? 'SQLite Database';
  useEffect(() => {
    document.title = name;
  }, [name]);

  if (state.status === 'loaded') {
    return (
      <main className="flex h-dvh select-text flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
        <section aria-label="Database tables" className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-(--vscode-panel-border) px-3">
            <h1 className="text-sm font-semibold">Tables</h1>
            <span className="text-xs tabular-nums text-(--vscode-descriptionForeground)">
              {state.data.tables.length}
            </span>
          </div>
          {state.data.tables.length ? (
            <div className="min-h-0 flex-1 overflow-auto">
              {state.data.tables.map((table) => (
                <button
                  key={table.name}
                  type="button"
                  onClick={() => postToHost({ type: 'openTable', tableName: table.name })}
                  className="flex h-10 w-full min-w-0 items-center gap-3 border-b border-(--vscode-panel-border) px-3 text-left text-sm hover:bg-(--vscode-list-hoverBackground)"
                >
                  <Icon name="table" variant="muted" size="sm" />
                  <span className="min-w-0 flex-1 truncate">{table.name}</span>
                  <span className="shrink-0 tabular-nums text-xs text-(--vscode-descriptionForeground)">
                    {table.rowCount} rows
                  </span>
                  <Icon name="chevron-right" variant="muted" size="sm" />
                </button>
              ))}
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center px-4 text-center">
              <div className="grid justify-items-center">
                <Icon name="database" size="2xl" variant="muted" className="mb-3" />
                <h2 className="text-sm font-semibold">No tables found</h2>
                <p className="mt-1 text-xs text-(--vscode-descriptionForeground)">
                  This SQLite database contains no user tables.
                </p>
              </div>
            </div>
          )}
        </section>
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

mountWebview('root', <App />);
