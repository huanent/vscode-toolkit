import { useEffect, useState } from 'react';
import type { DatabaseDocument, DatabaseEngine, DatabaseTable } from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/ui/button';
import { Empty } from '@/webview/components/ui/empty';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { Loading } from '@/webview/components/ui/loading';
import { Select } from '@/webview/components/ui/select';
import { getRootData, postToHost, useHostData } from '@/webview/utils/host-data';
import { DatabaseSelector } from './components/database-selector';
import { TableSchemaDialog } from './components/table-schema-dialog';
import { TableManagement } from './components/table-management';
import '@/webview/styles.css';

const databaseTitles: Record<DatabaseEngine, string> = {
  sqlite: 'SQLite Database',
  mysql: 'MySQL Database',
  postgresql: 'PostgreSQL Database',
};

function App() {
  const state = useHostData<DatabaseDocument>();
  const [editingTable, setEditingTable] = useState<DatabaseTable | null>(null);
  const [creatingTable, setCreatingTable] = useState(false);
  const [search, setSearch] = useState('');
  const defaultTitle = state.status === 'loaded' ? databaseTitles[state.data.engine] : 'Database';
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
          {state.data.schemas && (
            <Select
              ariaLabel="Schema"
              className="w-32"
              placeholder="No schemas"
              disabled={!state.data.schemas.length}
              value={state.data.currentSchema}
              options={state.data.schemas.map((schema) => ({ value: schema, label: schema }))}
              onValueChange={(schema) => postToHost({ type: 'selectSchema', schema })}
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
              shortcut="refresh"
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
              disabled={state.data.engine === 'postgresql' && !state.data.currentSchema}
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
            <TableManagement
              tables={visibleTables}
              database={state.data.currentDatabase}
              schema={state.data.currentSchema}
              engine={state.data.engine}
              onEditSchema={setEditingTable}
            />
          ) : (
            <div className="grid min-h-0 flex-1 place-items-center px-4 text-center">
              <Empty
                icon="database"
                title="No tables found"
                description={
                  state.data.engine === 'sqlite'
                    ? 'This SQLite database contains no user tables.'
                    : `Database "${state.data.currentDatabase ?? ''}" contains no tables.`
                }
              />
            </div>
          )}
        </section>
        {(editingTable || creatingTable) && (
          <TableSchemaDialog
            key={JSON.stringify([state.data.currentDatabase, state.data.currentSchema, editingTable?.name])}
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
      {state.status === 'loading' ? (
        <Loading label="Reading database..." />
      ) : (
        <ErrorMessage message="Could not load database tables." />
      )}
    </main>
  );
}

mountWebview('root', <App />);
