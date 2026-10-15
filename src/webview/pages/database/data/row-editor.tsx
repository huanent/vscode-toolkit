import { useState, type ChangeEvent } from 'react';
import type { DatabaseCellValue, DatabaseRowMutation, DatabaseTable } from '@/features/database/protocol';
import { Button } from '@/webview/components/button';
import { Dialog } from '@/webview/components/dialog';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Select } from '@/webview/components/select';
import { Textarea } from '@/webview/components/textarea';

type FieldValue = { mode: 'omit' | 'value' | 'null'; value: string };
type RowEditorProps = {
  table: DatabaseTable;
  original?: Record<string, DatabaseCellValue>;
  pending: boolean;
  error?: string;
  onClose: () => void;
  onSave: (mutation: DatabaseRowMutation) => void;
};

export function RowEditor({ table, original, pending, error, onClose, onSave }: RowEditorProps) {
  function initialField(name: string): FieldValue {
    return {
      mode: original ? (original[name] === null ? 'null' : 'value') : 'omit',
      value: String(original?.[name] ?? ''),
    };
  }
  const [fields, setFields] = useState<Record<string, FieldValue>>(() =>
    Object.fromEntries(table.columns.map((column) => [column.name, initialField(column.name)])),
  );
  const values: Record<string, DatabaseCellValue> = Object.fromEntries(
    table.columns.flatMap((column) => {
      const name = column.name;
      const field = fields[name]!;
      if (column.readOnly || field.mode === 'omit') return [];
      const value = field.mode === 'null' ? null : field.value;
      const unchanged =
        original &&
        (value === null ? original[name] === null : original[name] !== null && value === String(original[name]));
      return unchanged ? [] : [[name, value]];
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
      title={`${original ? 'Edit row' : 'Create row'} · ${table.name}`}
      className="text-sm"
      pending={pending}
      saveDisabled={!hasChanges}
      saveLabel={original ? 'Save' : 'Create'}
      onSave={() => onSave({ operation: original ? 'update' : 'create', values, original })}
      footer={
        original && (
          <span role="status" className="text-xs text-(--vscode-descriptionForeground)">
            {Object.keys(values).length} changed
          </span>
        )
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
          const changed = Object.hasOwn(values, column.name);
          const multiline =
            /text|clob|json|xml/i.test(column.type) || /[\r\n]/.test(field.value) || field.value.length > 120;
          const inputProps = {
            id: `row-field-${column.name}`,
            'aria-label': column.name,
            value: field.mode === 'null' ? '' : field.value,
            disabled: pending || column.readOnly || field.mode === 'null',
            placeholder: field.mode === 'null' ? 'NULL' : field.mode === 'omit' ? 'Default' : undefined,
            onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              updateField(column.name, { mode: 'value', value: event.target.value }),
          };
          const options = [
            ...(!original ? [{ value: 'omit', label: 'Default' }] : []),
            { value: 'value', label: 'Value' },
            ...((!column.notNull && !column.primaryKey) || field.mode === 'null'
              ? [{ value: 'null', label: 'NULL' }]
              : []),
          ];
          return (
            <div
              key={column.name}
              className="grid min-w-0 gap-2 border-b border-(--vscode-panel-border) pb-4 last:border-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label htmlFor={`row-field-${column.name}`} className="min-w-0 break-all font-medium">
                  {column.name}
                </label>
                <span className="min-w-0 break-all font-mono text-xs text-(--vscode-descriptionForeground)">
                  {column.type}
                  {column.primaryKey ? ' / PK' : ''}
                  {column.notNull ? ' / NOT NULL' : ''}
                  {column.readOnly ? ' / Read only' : ''}
                </span>
                {changed && (
                  <Button
                    variant="ghost"
                    size="sm"
                    prefix={<Icon name="discard" size="sm" />}
                    title={`Reset ${column.name}`}
                    aria-label={`Reset ${column.name}`}
                    disabled={pending}
                    onClick={() => updateField(column.name, initialField(column.name))}
                  />
                )}
                <Select
                  className="ml-auto w-28"
                  ariaLabel={`Value mode for ${column.name}`}
                  value={field.mode}
                  options={options}
                  disabled={pending || column.readOnly}
                  onValueChange={(mode) => {
                    if (mode === 'omit' || mode === 'value' || mode === 'null') updateField(column.name, { mode });
                  }}
                />
              </div>
              {multiline ? (
                <Textarea {...inputProps} className="min-h-20 font-mono text-sm" rows={4} />
              ) : (
                <Input {...inputProps} className="w-full font-mono text-sm" />
              )}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
