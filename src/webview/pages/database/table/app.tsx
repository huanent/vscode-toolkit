import { useEffect, useMemo, useState } from 'react';
import type { DatabaseDocument, DatabaseTable } from '@/features/database/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Icon } from '@/webview/components/icons';
import { Loading } from '@/webview/components/loading';
import { Table, type TableColumn } from '@/webview/components/table';
import { getRootData, postToHost, useHostData } from '@/webview/utils/host-data';
import { TableSchemaDialog } from './components/table-schema-dialog';
import '@/webview/styles.css';

function getTableColumns(
  onEditSchema: (table: DatabaseTable) => void,
): readonly TableColumn<DatabaseDocument['tables'][number]>[] {
  return [
    {
      key: 'name',
      header: 'Table',
      width: '24rem',
      className: 'min-w-56',
      cell: (table) => (
        <div className="flex min-w-0 items-center gap-2">
          <Icon name="table" variant="muted" size="sm" />
          <span className="min-w-0 truncate font-medium">{table.name}</span>
        </div>
      ),
    },
    {
      key: 'columns',
      header: 'Columns',
      align: 'right',
      width: '7rem',
      className: 'tabular-nums',
      cell: (table) => table.columnCount,
    },
    {
      key: 'primaryKey',
      header: 'Primary key',
      width: '12rem',
      className: 'min-w-36',
      cell: (table) => {
        const primaryKeys = table.columns.filter((column) => column.primaryKey).map((column) => column.name);
        return primaryKeys.length ? (
          <span className="truncate" title={primaryKeys.join(', ')}>
            {primaryKeys.join(', ')}
          </span>
        ) : (
          <span className="text-(--vscode-descriptionForeground)">None</span>
        );
      },
    },
    {
      key: 'rows',
      header: 'Rows',
      align: 'right',
      width: '8rem',
      className: 'tabular-nums',
      cell: (table) => table.rowCount.toLocaleString(),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '6rem',
      align: 'center',
      headerClassName: 'text-center',
      cell: (table) => (
        <button
          type="button"
          title="Edit schema"
          aria-label={`Edit schema for ${table.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onEditSchema(table);
          }}
          className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-(--vscode-descriptionForeground) hover:bg-(--vscode-toolbar-hoverBackground) hover:text-(--vscode-foreground) focus-visible:outline-1 focus-visible:outline-(--vscode-focusBorder)"
        >
          <Icon name="edit" size="sm" />
        </button>
      ),
    },
  ];
}

function App() {
  const state = useHostData<DatabaseDocument>();
  const [editingTable, setEditingTable] = useState<DatabaseTable | null>(null);
  const name = getRootData('name') ?? 'SQLite Database';
  useEffect(() => {
    document.title = name;
  }, [name]);

  const tableColumns = useMemo(() => getTableColumns(setEditingTable), []);

  if (state.status === 'loaded') {
    const tables = state.data.tables;

    return (
      <main className="flex h-dvh select-text flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
        <section aria-label="Database tables" className="flex min-h-0 flex-1 flex-col">
          {tables.length ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <Table
                ariaLabel="SQLite database tables"
                columns={tableColumns}
                rows={tables}
                rowKey={(table) => table.name}
                onRowClick={(table) => postToHost({ type: 'openTable', tableName: table.name })}
                emptyMessage="No tables found."
                className="min-w-full"
              />
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
