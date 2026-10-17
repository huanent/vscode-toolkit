import { useEffect, useRef, useState } from 'react';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';

type KeyValueRow = { id: string; key: string; value: string };

export type KeyValueEditorProps = {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
};

function createRows(value: Record<string, string>): KeyValueRow[] {
  return Object.entries(value).map(([key, entryValue]) => ({ id: crypto.randomUUID(), key, value: entryValue }));
}

export function KeyValueEditor({
  value,
  onChange,
  disabled,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: KeyValueEditorProps) {
  const [rows, setRows] = useState(() => createRows(value));
  const previousValue = useRef(value);

  useEffect(() => {
    if (previousValue.current !== value) {
      previousValue.current = value;
      setRows(createRows(value));
    }
  }, [value]);

  const updateRows = (nextRows: KeyValueRow[]) => {
    setRows(nextRows);
    if (nextRows.some((row) => !row.key.trim()) || new Set(nextRows.map((row) => row.key)).size !== nextRows.length) {
      return;
    }
    const nextValue = Object.fromEntries(nextRows.map((row) => [row.key, row.value]));
    previousValue.current = nextValue;
    onChange(nextValue);
  };

  return (
    <div className="grid min-w-0 gap-2">
      {rows.map((row, index) => {
        const error = !row.key.trim()
          ? 'Enter a key.'
          : rows.some((entry) => entry.id !== row.id && entry.key === row.key)
            ? 'Keys must be unique.'
            : '';
        return (
          <div key={row.id} className="flex min-w-0 items-start gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
              <Input
                aria-label={`${keyPlaceholder} ${index + 1}`}
                aria-invalid={error ? true : undefined}
                placeholder={keyPlaceholder}
                disabled={disabled}
                required
                value={row.key}
                ref={(input) => input?.setCustomValidity(error)}
                onChange={(event) => {
                  updateRows(
                    rows.map((entry) => (entry.id === row.id ? { ...entry, key: event.target.value } : entry)),
                  );
                }}
              />
              <Input
                aria-label={`${valuePlaceholder} ${index + 1}`}
                placeholder={valuePlaceholder}
                disabled={disabled}
                value={row.value}
                onChange={(event) => {
                  updateRows(
                    rows.map((entry) => (entry.id === row.id ? { ...entry, value: event.target.value } : entry)),
                  );
                }}
              />
              {error && <div className="text-(--vscode-errorForeground) sm:col-span-2">{error}</div>}
            </div>
            <Button
              variant="ghost"
              disabled={disabled}
              aria-label={`Remove row ${index + 1}`}
              title="Remove row"
              onClick={() => updateRows(rows.filter((entry) => entry.id !== row.id))}
            >
              <Icon name="trash" />
            </Button>
          </div>
        );
      })}
      <div>
        <Button
          variant="ghost"
          disabled={disabled}
          aria-label="Add row"
          title="Add row"
          onClick={() => updateRows([...rows, { id: crypto.randomUUID(), key: '', value: '' }])}
        >
          <Icon name="add" />
        </Button>
      </div>
    </div>
  );
}
