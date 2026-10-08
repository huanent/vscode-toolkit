import { useEffect, useState } from 'react';
import type { DatabaseDocument, DatabaseTable } from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Loading } from '@/webview/components/loading';
import { getRootData, postToHost, useHostData } from '@/webview/utils/host-data';
import { TableSchemaDialog } from './components/table-schema-dialog';
import { TableManagement } from './components/table-management';
import '@/webview/styles.css';

function App() {
  const state = useHostData<DatabaseDocument>();
  const [editingTable, setEditingTable] = useState<DatabaseTable | null>(null);
  const [creatingTable, setCreatingTable] = useState(false);
  const [search, setSearch] = useState('');
  const name = getRootData('name') ?? 'SQLite Database';
  useEffect(() => {
    document.title = name;
  }, [name]);

  if (state.status === 'loaded') {
    const tables = state.data.tables;
    const query = search.trim().toLowerCase();
    const visibleTables = tables.filter((table) => table.name.toLowerCase().includes(query));
    const rowCount = tables.reduce((total, table) => total + table.rowCount, 0);

    return (
      <main className="flex h-dvh select-text flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
        <div
          role="toolbar"
          aria-label="Database tools"
          className="flex shrink-0 items-center gap-3 border-b border-(--vscode-panel-border) px-3 py-2"
        >
          <div className="min-w-0 max-w-64 flex-1">
            <Input
              type="search"
              startSlot={<Icon name="search" size="sm" variant="muted" />}
              aria-label="Filter tables"
              placeholder="Filter tables..."
              value={search}
              disabled={tables.length === 0}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div role="group" aria-label="Database actions" className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="md"
              className="size-7 p-0"
              title="Create table"
              aria-label="Create table"
              icon={<Icon name="add" />}
              onClick={() => setCreatingTable(true)}
            />
            <Button
              variant="ghost"
              size="md"
              className="size-7 p-0"
              title="Open SQL Editor"
              aria-label="Open SQL Editor"
              icon={<Icon name="code" />}
              onClick={() => postToHost({ type: 'openSqlEditor' })}
            />
          </div>
        </div>
        <section aria-label="Database tables" className="flex min-h-0 flex-1 flex-col">
          {tables.length ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <TableManagement tables={visibleTables} onEditSchema={setEditingTable} />
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
        <footer className="flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-(--vscode-panel-border) px-3 py-1 text-xs tabular-nums text-(--vscode-descriptionForeground)">
          <span>
            {query
              ? `${visibleTables.length.toLocaleString()} of ${tables.length.toLocaleString()} tables`
              : `${tables.length.toLocaleString()} tables`}
          </span>
          <span>{rowCount.toLocaleString()} rows</span>
        </footer>
        {(editingTable || creatingTable) && (
          <TableSchemaDialog
            key={editingTable?.name ?? 'create-table'}
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setEditingTable(null);
                setCreatingTable(false);
              }
            }}
            table={editingTable ?? undefined}
            onClose={() => {
              setEditingTable(null);
              setCreatingTable(false);
            }}
          />
        )}
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
