import { useEffect, useState } from 'react';
import type { DatabaseEngine, DatabaseTable, DatabaseWebviewMessage } from '@/features/database/protocol';
import { Autocomplete } from '@/webview/components/ui/autocomplete';
import { Button } from '@/webview/components/ui/button';
import { Checkbox } from '@/webview/components/ui/checkbox';
import { DataList, type DataListColumn } from '@/webview/components/ui/data-list';
import { Dialog } from '@/webview/components/ui/dialog';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Form, FormItem } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { TabPanel, Tabs } from '@/webview/components/ui/tabs';
import { postToHost } from '@/webview/utils/host-data';
import { TableIndexEditor } from './table-index-editor';

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
  engine: DatabaseEngine;
  onClose: () => void;
}

const sqliteDataTypes = ['INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATETIME'];
const mysqlDataTypes = [
  'INT',
  'BIGINT',
  'VARCHAR(255)',
  'TEXT',
  'DATETIME',
  'TIMESTAMP',
  'TINYINT(1)',
  'DECIMAL(10,2)',
  'DOUBLE',
  'JSON',
  'BLOB',
];

const schemaDefaults = {
  sqlite: { dataTypes: sqliteDataTypes, defaultIdType: 'INTEGER', defaultColType: 'TEXT' },
  mysql: { dataTypes: mysqlDataTypes, defaultIdType: 'INT', defaultColType: 'VARCHAR(255)' },
  postgresql: {
    dataTypes: ['INTEGER', 'BIGINT', 'TEXT', 'VARCHAR(255)', 'BOOLEAN', 'NUMERIC', 'DATE', 'TIMESTAMP', 'UUID', 'JSONB', 'BYTEA'],
    defaultIdType: 'INTEGER',
    defaultColType: 'TEXT',
  },
} satisfies Record<DatabaseEngine, { dataTypes: string[]; defaultIdType: string; defaultColType: string }>;

export function TableSchemaDialog({ open, onOpenChange, table, engine, onClose }: TableSchemaDialogProps) {
  const { dataTypes, defaultIdType, defaultColType } = schemaDefaults[engine];

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
      : [{ id: crypto.randomUUID(), name: 'id', type: defaultIdType, primaryKey: true, notNull: true }],
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('columns');
  const [indexBusy, setIndexBusy] = useState(false);
  const [columnDraft, setColumnDraft] = useState<EditableColumn>();

  useEffect(() => {
    const handler = (event: MessageEvent<DatabaseWebviewMessage>) => {
      if (event.data?.type === 'schemaUpdateResult') {
        setIsSubmitting(false);
        if (event.data.success) onClose();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onClose]);

  const handleAddColumn = () => {
    const names = new Set(columns.map((column) => column.name.trim().toLowerCase()));
    let suffix = columns.length + 1;
    while (names.has(`column_${suffix}`)) suffix += 1;
    setColumnDraft({
      id: crypto.randomUUID(),
      name: `column_${suffix}`,
      type: defaultColType,
      primaryKey: false,
      notNull: false,
    });
  };

  const editingColumn = columns.some((column) => column.id === columnDraft?.id);
  const validateColumnDraft = (draft: EditableColumn) => {
    const name = draft.name.trim();
    if (!name) return 'Column name cannot be empty.';
    if (!draft.type.trim()) return 'Column type cannot be empty.';
    if (columns.some((column) => column.id !== draft.id && column.name.trim().toLowerCase() === name.toLowerCase())) {
      return `Duplicate column name: "${name}".`;
    }
  };
  const columnDraftError = columnDraft && validateColumnDraft(columnDraft);

  const applyColumn = () => {
    if (!columnDraft || columnDraftError) return;
    const next = { ...columnDraft, name: columnDraft.name.trim(), type: columnDraft.type.trim() };
    setColumns((prev) => editingColumn ? prev.map((column) => (column.id === next.id ? next : column)) : [...prev, next]);
    setColumnDraft(undefined);
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
    if (isSubmitting || columnDraft || activeTab !== 'columns') return;
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
      originalColumns: table?.columns.map(({ name }) => name),
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
  const tableColumns: DataListColumn<EditableColumn>[] = [
    {
      key: 'name',
      header: 'Name',
      className: 'min-w-36 flex-1',
      cell: (col) => col.name,
    },
    {
      key: 'type',
      header: 'Type',
      className: 'min-w-36 flex-1',
      cell: (col) => col.type,
    },
    {
      key: 'primaryKey',
      header: 'PK',
      align: 'center',
      className: 'w-10 shrink-0',
      cell: (col) => col.primaryKey ? 'Yes' : 'No',
    },
    {
      key: 'notNull',
      header: 'Not Null',
      align: 'center',
      className: 'w-16 shrink-0 whitespace-nowrap',
      cell: (col) => col.notNull ? 'Yes' : 'No',
    },
    {
      key: 'action',
      header: 'Actions',
      align: 'right',
      className: 'w-16 shrink-0',
      cell: (col, index) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setColumnDraft(col)}
            disabled={isSubmitting}
            prefix={<Icon name="edit" />}
            title="Edit column"
            aria-label={`Edit column ${col.name || index + 1}`}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveColumn(col.id)}
            disabled={isSubmitting || columns.length <= 1}
            prefix={<Icon name="trash" />}
            title="Remove column"
            aria-label={`Remove column ${col.name || index + 1}`}
          />
        </div>
      ),
    },
  ];

  const columnFields = (
    <div className="flex min-w-0 flex-col gap-3 pt-2">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-(--vscode-foreground)">Columns ({columns.length})</span>
          <Button type="button" variant="secondary" prefix={<Icon name="add" />} onClick={handleAddColumn}>
            Add Column
          </Button>
        </div>

        <DataList
          ariaLabel="Columns"
          columns={tableColumns}
          entries={columns}
          entryKey={(col) => col.id}
          scrollBodyOnly
          className="max-h-64 flex-none bg-transparent"
        />
      </div>

      {error && <ErrorMessage message={error} />}
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isSubmitting && !indexBusy && !columnDraft) onOpenChange(nextOpen);
      }}
      title={table ? `Edit Schema: ${table.name}` : 'Create Table'}
      className="w-176 max-w-full max-h-full"
      form={activeTab === 'columns' ? 'table-schema-form' : undefined}
      pending={isSubmitting || indexBusy}
      saveDisabled={Boolean(validationError || columnDraft)}
      saveLabel={table ? 'Save' : 'Create Table'}
    >
      <Form id="table-schema-form" onFormSubmit={handleSubmit}>
        <fieldset disabled={isSubmitting} aria-busy={isSubmitting} className="flex min-w-0 flex-col pt-2">
          <FormItem name="tableName" label="Table Name">
            <Input
              id="schema-table-name"
              value={activeTab === 'indexes' && table ? table.name : tableName}
              readOnly={activeTab === 'indexes'}
              onChange={(e) => {
                setTableName(e.target.value);
                setError(null);
              }}
              placeholder="Table name"
            />
          </FormItem>

          {table ? (
            <Tabs
              tabs={[{ id: 'columns', label: 'Columns' }, { id: 'indexes', label: 'Indexes' }]}
              activeTabId={activeTab}
              onChange={(tab) => {
                if (!isSubmitting && !indexBusy) setActiveTab(tab);
              }}
            >
              <TabPanel tabId="columns">{columnFields}</TabPanel>
              <TabPanel tabId="indexes"><TableIndexEditor table={table} onBusyChange={setIndexBusy} /></TabPanel>
            </Tabs>
          ) : columnFields}
        </fieldset>
      </Form>
      {columnDraft && (
        <Dialog
          open
          onOpenChange={(nextOpen) => { if (!nextOpen) setColumnDraft(undefined); }}
          title={editingColumn ? 'Edit Column' : 'Add Column'}
          className="w-96"
          form="column-draft-form"
          saveLabel="Apply Column"
          saveDisabled={Boolean(columnDraftError)}
        >
          <Form id="column-draft-form" onFormSubmit={applyColumn} className="grid gap-2">
            <FormItem name="name" label="Name">
              <Input value={columnDraft.name} onChange={(event) => setColumnDraft({ ...columnDraft, name: event.target.value })} />
            </FormItem>
            <FormItem name="type" label="Type">
              <Autocomplete aria-label="Column type" items={dataTypes} value={columnDraft.type} onValueChange={(type) => setColumnDraft({ ...columnDraft, type })} />
            </FormItem>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <Checkbox checked={columnDraft.primaryKey} onCheckedChange={(primaryKey) => setColumnDraft({ ...columnDraft, primaryKey })} />
                <span>Primary Key</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={columnDraft.notNull} onCheckedChange={(notNull) => setColumnDraft({ ...columnDraft, notNull })} />
                <span>Not Null</span>
              </label>
            </div>
            {columnDraftError && <ErrorMessage message={columnDraftError} />}
          </Form>
        </Dialog>
      )}
    </Dialog>
  );
}
