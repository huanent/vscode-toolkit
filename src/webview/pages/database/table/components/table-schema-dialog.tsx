import { useEffect, useState } from 'react';
import type { DatabaseTable, DatabaseWebviewMessage } from '@/features/database/protocol';
import {
  buildSqliteCreateTableStatement,
  buildSqliteTableSchemaStatements,
  sqliteTemporaryTablePrefix,
} from '@/features/database/sqlite-schema';
import { Autocomplete } from '@/webview/components/autocomplete';
import { Button } from '@/webview/components/button';
import { Checkbox } from '@/webview/components/checkbox';
import { Dialog } from '@/webview/components/dialog';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Table, type TableColumn } from '@/webview/components/table';
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
  table?: DatabaseTable;
  onClose: () => void;
}

const tabs = [
  { id: 'columns', label: 'Columns' },
  { id: 'sql', label: 'SQL Preview' },
];

const sqliteDataTypes = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATETIME'];

function generatePreviewSql(table: DatabaseTable | undefined, tableName: string, columns: EditableColumn[]): string {
  if (!table) return `${buildSqliteCreateTableStatement({ tableName, columns })};`;
  return buildSqliteTableSchemaStatements(
    { tableName: table.name, newTableName: tableName, columns },
    table.columns.map((col) => col.name),
    sqliteTemporaryTablePrefix,
  )
    .map((statement) => `${statement};`)
    .join('\n');
}

export function TableSchemaDialog({ open, onOpenChange, table, onClose }: TableSchemaDialogProps) {
  const [tableName, setTableName] = useState(table?.name ?? '');
  const [columns, setColumns] = useState<EditableColumn[]>(() =>
    table
      ? table.columns.map((col) => ({
          id: crypto.randomUUID(),
          name: col.name,
          type: col.type,
          primaryKey: col.primaryKey,
          notNull: col.notNull,
          originalName: col.name,
        }))
      : [{ id: crypto.randomUUID(), name: 'id', type: 'INTEGER', primaryKey: true, notNull: true }],
  );
  const [activeTab, setActiveTab] = useState('columns');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setColumns((prev) => {
      const names = new Set(prev.map((column) => column.name.trim().toLowerCase()));
      let suffix = prev.length + 1;
      while (names.has(`column_${suffix}`)) suffix += 1;
      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: `column_${suffix}`,
          type: 'TEXT',
          primaryKey: false,
          notNull: false,
        },
      ];
    });
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

  const validateSchema = (): string | null => {
    const trimmedTableName = tableName.trim();
    if (!trimmedTableName) {
      return 'Table name cannot be empty.';
    }
    if (columns.length === 0) {
      return 'A table must have at least one column.';
    }
    for (const col of columns) {
      if (!col.name.trim()) {
        return 'Column name cannot be empty.';
      }
    }

    const seen = new Set<string>();
    for (const col of columns) {
      const lower = col.name.trim().toLowerCase();
      if (seen.has(lower)) {
        return `Duplicate column name: "${col.name.trim()}".`;
      }
      seen.add(lower);
    }
    return null;
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    const validationError = validateSchema();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    postToHost({
      type: table ? 'updateTableSchema' : 'createTable',
      tableName: table ? table.name : tableName.trim(),
      newTableName: tableName.trim(),
      columns: columns.map((col) => ({
        name: col.name.trim(),
        type: col.type.trim(),
        primaryKey: col.primaryKey,
        notNull: col.notNull,
        originalName: col.originalName,
      })),
    });
  };

  const validationError = validateSchema();
  const previewSql = validationError ?? generatePreviewSql(table, tableName.trim(), columns);
  const tableColumns: TableColumn<EditableColumn>[] = [
    {
      key: 'name',
      header: 'Name',
      className: 'border-b border-(--vscode-panel-border) p-1',
      cell: (col, index) => (
        <Input
          value={col.name}
          onChange={(e) => handleColumnChange(col.id, { name: e.target.value })}
          placeholder="Column name"
          aria-label={`Column ${index + 1} name`}
        />
      ),
    },
    {
      key: 'type',
      header: 'Type',
      className: 'border-b border-(--vscode-panel-border) p-1',
      cell: (col, index) => (
        <Autocomplete
          items={sqliteDataTypes}
          value={col.type}
          onValueChange={(type) => handleColumnChange(col.id, { type })}
          disabled={isSubmitting}
          placeholder="Data type"
          aria-label={`Column ${index + 1} type`}
        />
      ),
    },
    {
      key: 'primaryKey',
      header: 'PK',
      align: 'center',
      headerClassName: 'min-w-0',
      className: 'border-b border-(--vscode-panel-border) p-1',
      cell: (col, index) => (
        <div className="flex justify-center">
          <Checkbox
            disabled={isSubmitting}
            checked={col.primaryKey}
            onCheckedChange={(checked) => handleColumnChange(col.id, { primaryKey: Boolean(checked) })}
            ariaLabel={`Column ${col.name || index + 1} primary key`}
          />
        </div>
      ),
    },
    {
      key: 'notNull',
      header: 'Not Null',
      align: 'center',
      headerClassName: 'min-w-0 whitespace-nowrap',
      className: 'border-b border-(--vscode-panel-border) p-1',
      cell: (col, index) => (
        <div className="flex justify-center">
          <Checkbox
            disabled={isSubmitting}
            checked={col.notNull}
            onCheckedChange={(checked) => handleColumnChange(col.id, { notNull: Boolean(checked) })}
            ariaLabel={`Column ${col.name || index + 1} not null`}
          />
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'center',
      headerClassName: 'min-w-0',
      className: 'border-b border-(--vscode-panel-border) p-1',
      cell: (col, index) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => handleRemoveColumn(col.id)}
          disabled={isSubmitting || columns.length <= 1}
          className="size-6 text-(--vscode-descriptionForeground) hover:text-(--vscode-errorForeground)"
          title="Remove column"
          aria-label={`Remove column ${col.name || index + 1}`}
        >
          <Icon name="trash" size="sm" />
        </Button>
      ),
    },
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting) onOpenChange(nextOpen);
      }}
      title={table ? `Edit Schema: ${table.name}` : 'Create Table'}
      description={table ? 'Modify the table name, columns, and constraints.' : undefined}
      className="w-176 max-w-full max-h-full overflow-y-auto"
    >
      <fieldset disabled={isSubmitting} aria-busy={isSubmitting} className="flex min-w-0 flex-col gap-3 pt-2">
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

              <Table
                ariaLabel="Columns"
                columns={tableColumns}
                rows={columns}
                rowKey={(col) => col.id}
                className="max-h-64 rounded border border-(--vscode-panel-border)"
              />
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
          <Button size="sm" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          {activeTab === 'sql' ? (
            <Button
              size="sm"
              variant="primary"
              onClick={handleSubmit}
              disabled={isSubmitting || Boolean(validationError)}
            >
              {isSubmitting ? (table ? 'Saving...' : 'Creating...') : table ? 'Save' : 'Create Table'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                if (validationError) setError(validationError);
                else setActiveTab('sql');
              }}
            >
              Preview SQL
            </Button>
          )}
        </div>
      </fieldset>
    </Dialog>
  );
}
