import { useEffect, useState } from 'react';
import type { DatabaseTable, DatabaseWebviewMessage } from '@/features/database/protocol';
import { buildSqliteTableSchemaStatements, sqliteTemporaryTablePrefix } from '@/features/database/sqlite-schema';
import { Button } from '@/webview/components/button';
import { Checkbox } from '@/webview/components/checkbox';
import { Dialog } from '@/webview/components/dialog';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { TabPanel, Tabs } from '@/webview/components/tabs';
import { postToHost } from '@/webview/utils/host-data';

interface EditableColumn {
  id: string;
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
  originalName?: string;
}

interface TableSchemaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: DatabaseTable;
  onClose: () => void;
}

const tabs = [
  { id: 'columns', label: 'Columns' },
  { id: 'sql', label: 'SQL Preview' },
];

function generatePreviewSql(table: DatabaseTable, tableName: string, columns: EditableColumn[]): string {
  return buildSqliteTableSchemaStatements(
    { tableName: table.name, newTableName: tableName, columns },
    table.columns.map((col) => col.name),
    sqliteTemporaryTablePrefix,
  )
    .map((statement) => `${statement};`)
    .join('\n');
}

export function TableSchemaDialog({ open, onOpenChange, table, onClose }: TableSchemaDialogProps) {
  const [tableName, setTableName] = useState(table.name);
  const [columns, setColumns] = useState<EditableColumn[]>(() =>
    table.columns.map((col) => ({
      id: crypto.randomUUID(),
      name: col.name,
      type: col.type,
      primaryKey: col.primaryKey,
      notNull: col.notNull,
      originalName: col.name,
    })),
  );
  const [activeTab, setActiveTab] = useState('columns');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTableName(table.name);
    setColumns(
      table.columns.map((col) => ({
        id: crypto.randomUUID(),
        name: col.name,
        type: col.type,
        primaryKey: col.primaryKey,
        notNull: col.notNull,
        originalName: col.name,
      })),
    );
    setError(null);
    setIsSubmitting(false);
    setActiveTab('columns');
  }, [table]);

  useEffect(() => {
    const handler = (event: MessageEvent<DatabaseWebviewMessage>) => {
      if (event.data?.type === 'schemaUpdateResult') {
        setIsSubmitting(false);
        if (event.data.success) {
          onClose();
        } else {
          setError(event.data.error);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onClose]);

  const handleColumnChange = (id: string, updates: Partial<EditableColumn>) => {
    setColumns((prev) => prev.map((col) => (col.id === id ? { ...col, ...updates } : col)));
    setError(null);
  };

  const handleAddColumn = () => {
    setColumns((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `column_${prev.length + 1}`,
        type: 'TEXT',
        primaryKey: false,
        notNull: false,
      },
    ]);
    setError(null);
  };

  const handleRemoveColumn = (id: string) => {
    if (columns.length <= 1) {
      setError('A table must have at least one column.');
      return;
    }
    setColumns((prev) => prev.filter((col) => col.id !== id));
    setError(null);
  };

  const handleSubmit = () => {
    const trimmedTableName = tableName.trim();
    if (!trimmedTableName) {
      setError('Table name cannot be empty.');
      return;
    }
    if (columns.length === 0) {
      setError('A table must have at least one column.');
      return;
    }
    for (const col of columns) {
      if (!col.name.trim()) {
        setError('Column name cannot be empty.');
        return;
      }
    }

    const seen = new Set<string>();
    for (const col of columns) {
      const lower = col.name.trim().toLowerCase();
      if (seen.has(lower)) {
        setError(`Duplicate column name: "${col.name.trim()}".`);
        return;
      }
      seen.add(lower);
    }

    setIsSubmitting(true);
    setError(null);
    postToHost({
      type: 'updateTableSchema',
      tableName: table.name,
      newTableName: trimmedTableName,
      columns: columns.map((col) => ({
        name: col.name.trim(),
        type: col.type.trim(),
        primaryKey: col.primaryKey,
        notNull: col.notNull,
        originalName: col.originalName,
      })),
    });
  };

  const previewSql = generatePreviewSql(table, tableName.trim() || table.name, columns);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit Schema: ${table.name}`}
      description="Modify the table name, columns, and constraints."
      className="w-176 max-w-full"
    >
      <div className="flex flex-col gap-3 pt-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="schema-table-name" className="text-xs font-medium text-(--vscode-descriptionForeground)">
            Table Name
          </label>
          <Input
            id="schema-table-name"
            value={tableName}
            onChange={(e) => {
              setTableName(e.target.value);
              setError(null);
            }}
            placeholder="Table name"
          />
        </div>

        <Tabs tabs={tabs} activeTabId={activeTab} onChange={setActiveTab}>
          <TabPanel tabId="columns">
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-(--vscode-foreground)">Columns ({columns.length})</span>
                <Button variant="secondary" size="sm" icon={<Icon name="add" size="sm" />} onClick={handleAddColumn}>
                  Add Column
                </Button>
              </div>

              <div className="max-h-64 overflow-y-auto rounded border border-(--vscode-panel-border)">
                <table className="w-full border-separate border-spacing-0 text-xs" aria-label="Columns">
                  <thead className="sticky top-0 z-10 bg-(--vscode-editor-background)">
                    <tr>
                      <th className="h-7 border-b border-(--vscode-panel-border) px-2 text-left font-medium text-(--vscode-descriptionForeground)">
                        Name
                      </th>
                      <th className="h-7 border-b border-(--vscode-panel-border) px-2 text-left font-medium text-(--vscode-descriptionForeground)">
                        Type
                      </th>
                      <th className="h-7 border-b border-(--vscode-panel-border) px-2 text-center font-medium text-(--vscode-descriptionForeground)">
                        PK
                      </th>
                      <th className="h-7 border-b border-(--vscode-panel-border) px-2 text-center font-medium text-(--vscode-descriptionForeground)">
                        Not Null
                      </th>
                      <th className="h-7 border-b border-(--vscode-panel-border) px-2 text-center font-medium text-(--vscode-descriptionForeground)">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((col, index) => (
                      <tr key={col.id} className="hover:bg-(--vscode-list-hoverBackground)">
                        <td className="border-b border-(--vscode-panel-border) p-1">
                          <Input
                            value={col.name}
                            onChange={(e) => handleColumnChange(col.id, { name: e.target.value })}
                            placeholder="Column name"
                            aria-label={`Column ${index + 1} name`}
                          />
                        </td>
                        <td className="border-b border-(--vscode-panel-border) p-1">
                          <Input
                            list="sqlite-data-types"
                            value={col.type}
                            onChange={(e) => handleColumnChange(col.id, { type: e.target.value })}
                            placeholder="Data type"
                            aria-label={`Column ${index + 1} type`}
                          />
                        </td>
                        <td className="border-b border-(--vscode-panel-border) p-1 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={col.primaryKey}
                              onCheckedChange={(checked) =>
                                handleColumnChange(col.id, { primaryKey: Boolean(checked) })
                              }
                              ariaLabel={`Column ${col.name || index + 1} primary key`}
                            />
                          </div>
                        </td>
                        <td className="border-b border-(--vscode-panel-border) p-1 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={col.notNull}
                              onCheckedChange={(checked) => handleColumnChange(col.id, { notNull: Boolean(checked) })}
                              ariaLabel={`Column ${col.name || index + 1} not null`}
                            />
                          </div>
                        </td>
                        <td className="border-b border-(--vscode-panel-border) p-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveColumn(col.id)}
                            disabled={columns.length <= 1}
                            className="inline-flex size-6 cursor-pointer items-center justify-center rounded text-(--vscode-descriptionForeground) hover:bg-(--vscode-toolbar-hoverBackground) hover:text-(--vscode-errorForeground) disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-1 focus-visible:outline-(--vscode-focusBorder)"
                            title="Remove column"
                            aria-label={`Remove column ${col.name || index + 1}`}
                          >
                            <Icon name="trash" size="sm" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <datalist id="sqlite-data-types">
                <option value="INTEGER" />
                <option value="TEXT" />
                <option value="REAL" />
                <option value="BLOB" />
                <option value="NUMERIC" />
                <option value="BOOLEAN" />
                <option value="DATETIME" />
              </datalist>
            </div>
          </TabPanel>

          <TabPanel tabId="sql">
            <div className="py-2">
              <pre className="max-h-64 overflow-auto rounded border border-(--vscode-panel-border) bg-(--vscode-editor-background) p-3 font-mono text-xs leading-relaxed text-(--vscode-foreground) select-text whitespace-pre-wrap break-all">
                {previewSql}
              </pre>
            </div>
          </TabPanel>
        </Tabs>

        {error && (
          <div
            role="alert"
            className="rounded border border-(--vscode-inputValidation-errorBorder) bg-(--vscode-inputValidation-errorBackground) p-2 text-xs text-(--vscode-errorForeground)"
          >
            {error}
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2 border-t border-(--vscode-panel-border) pt-3">
          {activeTab === 'sql' ? (
            <Button size="sm" variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={() => setActiveTab('sql')}>
              Preview SQL
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
