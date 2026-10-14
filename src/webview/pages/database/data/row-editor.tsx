import { useState } from 'react';
import type { DatabaseCellValue, DatabaseRowMutation, DatabaseTable } from '@/features/database/protocol';
import { Button } from '@/webview/components/button';
import { Dialog } from '@/webview/components/dialog';
import { Icon } from '@/webview/components/icons';
import { Select } from '@/webview/components/select';
import { Textarea } from '@/webview/components/textarea';

type FieldValue = { mode: string; value: string };
type RowEditorProps = {
  table: DatabaseTable;
  original?: Record<string, DatabaseCellValue>;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSave: (mutation: DatabaseRowMutation) => void;
};

export function RowEditor({ table, original, pending, error, onClose, onSave }: RowEditorProps) {
  const [fields, setFields] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(
      table.columns.map((column) => [column.name, { mode: 'omit', value: String(original?.[column.name] ?? '') }]),
    ),
  );
  const values: Record<string, DatabaseCellValue> = Object.fromEntries(
    Object.entries(fields).flatMap(([name, field]) => {
      if (field.mode === 'omit') return [];
      const value = field.mode === 'null' ? null : field.value;
      return original && value === original[name] ? [] : [[name, value]];
    }),
  );
  const hasChanges = !original || Object.keys(values).length > 0;
  function updateField(name: string, update: Partial<FieldValue>) {
    setFields((previous) => ({ ...previous, [name]: { ...previous[name]!, ...update } }));
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      title={original ? 'Edit row' : 'Create row'}
      className="text-sm"
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            prefix={<Icon name={pending ? 'loading' : 'save'} className={pending ? 'animate-spin' : undefined} />}
            disabled={pending || !hasChanges}
            onClick={() => onSave({ operation: original ? 'update' : 'create', values, original })}
          >
            {pending ? 'Saving...' : original ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 py-3">
        {error && (
          <p role="alert" className="m-0 text-(--vscode-errorForeground)">
            {error}
          </p>
        )}
        {table.columns.map((column) => {
          const field = fields[column.name]!;
          const options = [
            { value: 'omit', label: original ? 'Unchanged' : 'Default' },
            { value: 'value', label: 'Value' },
            ...(!column.notNull && !column.primaryKey ? [{ value: 'null', label: 'NULL' }] : []),
          ];
          return (
            <div key={column.name} className="grid min-w-0 gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label htmlFor={`row-field-${column.name}`} className="min-w-0 break-all font-medium">
                  {column.name}
                </label>
                <span className="min-w-0 break-all font-mono text-xs text-(--vscode-descriptionForeground)">
                  {column.type}
                  {column.primaryKey ? ' / PK' : ''}
                  {column.readOnly ? ' / Read only' : ''}
                </span>
                <Select
                  className="ml-auto w-28"
                  ariaLabel={`Value mode for ${column.name}`}
                  value={field.mode}
                  options={options}
                  disabled={pending || column.readOnly}
                  onValueChange={(mode) => updateField(column.name, { mode })}
                />
              </div>
              <Textarea
                id={`row-field-${column.name}`}
                aria-label={column.name}
                className="min-h-12 font-mono text-sm"
                rows={2}
                value={field.value}
                disabled={pending || column.readOnly || field.mode !== 'value'}
                placeholder={field.mode === 'null' ? 'NULL' : undefined}
                onChange={(event) => updateField(column.name, { value: event.target.value })}
              />
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
