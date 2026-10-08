import { useEffect, useState } from 'react';
import type { DatabaseDocument, DatabaseTable } from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Icon } from '@/webview/components/icons';
import { Loading } from '@/webview/components/loading';
import { getRootData, useHostData } from '@/webview/utils/host-data';
import { TableSchemaDialog } from './components/table-schema-dialog';
import { TableManagement } from './components/table-management';
import '@/webview/styles.css';

function App() {
  const state = useHostData<DatabaseDocument>();
  const [editingTable, setEditingTable] = useState<DatabaseTable | null>(null);
  const name = getRootData('name') ?? 'SQLite Database';
  useEffect(() => {
    document.title = name;
  }, [name]);

  if (state.status === 'loaded') {
    const tables = state.data.tables;

    return (
      <main className="flex h-dvh select-text flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
        <section aria-label="Database tables" className="flex min-h-0 flex-1 flex-col">
          {tables.length ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <TableManagement tables={tables} onEditSchema={setEditingTable} />
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
        {editingTable && (
          <TableSchemaDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) setEditingTable(null);
            }}
            table={editingTable}
            onClose={() => setEditingTable(null)}
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
