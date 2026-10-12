import { useEffect, useRef, useState } from 'react';
import type { DatabaseTable, DatabaseWebviewMessage } from '@/features/database/protocol';
import { Autocomplete } from '@/webview/components/autocomplete';
import { Button } from '@/webview/components/button';
import { Checkbox } from '@/webview/components/checkbox';
import { Dialog } from '@/webview/components/dialog';
import { Form, FormItem } from '@/webview/components/form';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Table, type TableColumn } from '@/webview/components/table';
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
  engine?: 'sqlite' | 'mysql';
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

export function TableSchemaDialog({ open, onOpenChange, table, engine, onClose }: TableSchemaDialogProps) {
  const dataTypes = engine === 'mysql' ? mysqlDataTypes : sqliteDataTypes;
  const defaultIdType = engine === 'mysql' ? 'INT' : 'INTEGER';
  const defaultColType = engine === 'mysql' ? 'VARCHAR(255)' : 'TEXT';

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
  const pendingColumnFocus = useRef<string | null>(null);

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
    const id = crypto.randomUUID();
    pendingColumnFocus.current = id;
    setColumns((prev) => {
      const names = new Set(prev.map((column) => column.name.trim().toLowerCase()));
      let suffix = prev.length + 1;
      while (names.has(`column_${suffix}`)) suffix += 1;
      return [
        ...prev,
        {
          id,
          name: `column_${suffix}`,
          type: defaultColType,
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
  const tableColumns: TableColumn<EditableColumn>[] = [
    {
      key: 'name',
      header: 'Name',
      className: 'border-b border-(--vscode-panel-border) p-1',
      cell: (col, index) => (
        <FormItem name={`columns.${col.id}.name`} className="contents">
          <Input
            ref={(input) => {
              if (!input || pendingColumnFocus.current !== col.id) return;
              pendingColumnFocus.current = null;
              input.closest('tr')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
              input.focus({ preventScroll: true });
              input.select();
            }}
            value={col.name}
            onChange={(e) => handleColumnChange(col.id, { name: e.target.value })}
            placeholder="Column name"
            aria-label={`Column ${index + 1} name`}
          />
        </FormItem>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      className: 'border-b border-(--vscode-panel-border) p-1',
      cell: (col, index) => (
        <FormItem name={`columns.${col.id}.type`} className="contents">
          <Autocomplete
            items={dataTypes}
            value={col.type}
            onValueChange={(type) => handleColumnChange(col.id, { type })}
            disabled={isSubmitting}
            placeholder="Data type"
            aria-label={`Column ${index + 1} type`}
          />
        </FormItem>
      ),
    },
    {
      key: 'primaryKey',
      header: 'PK',
      align: 'center',
      headerClassName: 'min-w-0',
      className: 'border-b border-(--vscode-panel-border) p-1',
      cell: (col, index) => (
        <FormItem name={`columns.${col.id}.primaryKey`} className="contents">
          <Checkbox
            disabled={isSubmitting}
            checked={col.primaryKey}
            onCheckedChange={(checked) => handleColumnChange(col.id, { primaryKey: Boolean(checked) })}
            ariaLabel={`Column ${col.name || index + 1} primary key`}
          />
        </FormItem>
      ),
    },
    {
      key: 'notNull',
      header: 'Not Null',
      align: 'center',
      headerClassName: 'min-w-0 whitespace-nowrap',
      className: 'border-b border-(--vscode-panel-border) p-1',
      cell: (col, index) => (
        <FormItem name={`columns.${col.id}.notNull`} className="contents">
          <Checkbox
            disabled={isSubmitting}
            checked={col.notNull}
            onCheckedChange={(checked) => handleColumnChange(col.id, { notNull: Boolean(checked) })}
            ariaLabel={`Column ${col.name || index + 1} not null`}
          />
        </FormItem>
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
      className="w-176 max-w-full max-h-full"
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            form="table-schema-form"
            disabled={isSubmitting || Boolean(validationError)}
          >
            {isSubmitting ? (table ? 'Saving...' : 'Creating...') : table ? 'Save' : 'Create Table'}
          </Button>
        </>
      }
    >
      <Form id="table-schema-form" onFormSubmit={handleSubmit}>
        <fieldset disabled={isSubmitting} aria-busy={isSubmitting} className="flex min-w-0 flex-col gap-3 pt-2">
          <FormItem name="tableName" label="Table Name">
            <Input
              id="schema-table-name"
              value={tableName}
              onChange={(e) => {
                setTableName(e.target.value);
                setError(null);
              }}
              placeholder="Table name"
            />
          </FormItem>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-(--vscode-foreground)">Columns ({columns.length})</span>
              <Button variant="secondary" size="sm" prefix={<Icon name="add" size="sm" />} onClick={handleAddColumn}>
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

          {error && (
            <div
              role="alert"
              className="rounded border border-(--vscode-inputValidation-errorBorder) bg-(--vscode-inputValidation-errorBackground) p-2 text-xs text-(--vscode-errorForeground)"
            >
              {error}
            </div>
          )}
        </fieldset>
      </Form>
    </Dialog>
  );
}
