import { useEffect, useState } from 'react';
import type { DatabaseDocument, DatabaseTable } from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/ui/button';
import { Empty } from '@/webview/components/ui/empty';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { Loading } from '@/webview/components/ui/loading';
import { getRootData, postToHost, useHostData } from '@/webview/utils/host-data';
import { DatabaseSelector } from './components/database-selector';
import { TableSchemaDialog } from './components/table-schema-dialog';
import { TableManagement } from './components/table-management';
import '@/webview/styles.css';

function App() {
  const state = useHostData<DatabaseDocument>();
  const [editingTable, setEditingTable] = useState<DatabaseTable | null>(null);
  const [creatingTable, setCreatingTable] = useState(false);
  const [search, setSearch] = useState('');
  const defaultTitle =
    state.status === 'loaded' && state.data.engine === 'mysql' ? 'MySQL Database' : 'SQLite Database';
  const name = getRootData('name') ?? defaultTitle;
  useEffect(() => {
    document.title = name;
  }, [name]);

  if (state.status === 'loaded') {
    const tables = state.data.tables;
    const query = search.trim().toLowerCase();
    const visibleTables = tables.filter((table) => table.name.toLowerCase().includes(query));

    return (
      <main className="flex h-dvh select-text flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
        <div
          role="toolbar"
          aria-label="Database tools"
          className="flex shrink-0 flex-wrap items-center gap-2 border-b border-(--vscode-panel-border) p-2"
        >
          {state.data.databases && (
            <DatabaseSelector
              databases={state.data.databases}
              currentDatabase={state.data.currentDatabase}
              onSelectDatabase={(database) => postToHost({ type: 'selectDatabase', database })}
              onCreateDatabase={(databaseName) => postToHost({ type: 'createDatabase', name: databaseName })}
              onDeleteDatabase={(database) => postToHost({ type: 'deleteDatabase', database })}
            />
          )}
          <div className="min-w-0 max-w-64 flex-1">
            <Input
              type="search"
              prefix={<Icon name="search" size="sm" variant="muted" />}
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
              title="Refresh tables"
              aria-label="Refresh tables"
              prefix={<Icon name="refresh" />}
              onClick={() => postToHost({ type: 'ready' })}
            />
            <Button
              variant="ghost"
              size="md"
              title="Create table"
              aria-label="Create table"
              prefix={<Icon name="add" />}
              onClick={() => setCreatingTable(true)}
            />
            <Button
              variant="ghost"
              size="md"
              title="Open SQL Editor"
              aria-label="Open SQL Editor"
              prefix={<Icon name="code" />}
              onClick={() => postToHost({ type: 'openSqlEditor' })}
            />
          </div>
        </div>
        <section aria-label="Database tables" className="flex min-h-0 flex-1 flex-col">
          {tables.length ? (
            <TableManagement tables={visibleTables} onEditSchema={setEditingTable} />
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center px-4 text-center">
              <Empty
                icon="database"
                title="No tables found"
                description={
                  state.data.engine === 'mysql'
                    ? `Database "${state.data.currentDatabase ?? ''}" contains no tables.`
                    : 'This SQLite database contains no user tables.'
                }
              />
            </div>
          )}
        </section>
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
            engine={state.data.engine}
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
      {state.status === 'loading' ? <Loading label="Reading database..." /> : <ErrorMessage message={state.message} />}
    </main>
  );
}

mountWebview('root', <App />);
