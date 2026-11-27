import { useEffect, useRef, useState } from 'react';
import type { DatabaseTable, DatabaseWebviewMessage, TableIndex, TableIndexChange, TableIndexDefinition } from '@/features/database/protocol';
import { Button } from '@/webview/components/ui/button';
import { Checkbox } from '@/webview/components/ui/checkbox';
import { DataList, type DataListColumn } from '@/webview/components/ui/data-list';
import { Dialog } from '@/webview/components/ui/dialog';
import { Form, FormItem } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { Select } from '@/webview/components/ui/select';
import { postToHost } from '@/webview/utils/host-data';

interface IndexDraft extends TableIndexDefinition {
  original?: TableIndexDefinition;
}

export function TableIndexEditor({ table, onBusyChange }: { table: DatabaseTable; onBusyChange: (busy: boolean) => void }) {
  const [indexes, setIndexes] = useState<TableIndex[]>();
  const [busy, setBusy] = useState(true);
  const [draft, setDraft] = useState<IndexDraft>();
  const pending = useRef<string | undefined>(undefined);
  const request = (change?: TableIndexChange) => {
    const requestId = crypto.randomUUID();
    pending.current = requestId;
    setBusy(true);
    onBusyChange(true);
    postToHost(change
      ? { type: 'changeTableIndex', requestId, tableName: table.name, change }
      : { type: 'readTableIndexes', requestId, tableName: table.name });
  };
  useEffect(() => {
    const listener = ({ data }: MessageEvent<DatabaseWebviewMessage>) => {
      if (data?.type !== 'tableIndexesResult' || data.requestId !== pending.current) return;
      pending.current = undefined;
      setBusy(false);
      onBusyChange(false);
      if (data.indexes) {
        setIndexes(data.indexes);
        setDraft(undefined);
      }
    };
    window.addEventListener('message', listener);
    const requestId = crypto.randomUUID();
    pending.current = requestId;
    postToHost({ type: 'readTableIndexes', requestId, tableName: table.name });
    return () => window.removeEventListener('message', listener);
  }, [table.name, onBusyChange]);

  const columns: DataListColumn<TableIndex>[] = [
    { key: 'name', header: 'Name', className: 'min-w-32 flex-1', cell: (index) => index.name },
    { key: 'columns', header: 'Columns', className: 'min-w-40 flex-1', cell: (index) => index.columns.join(', ') },
    { key: 'unique', header: 'Unique', className: 'w-16 shrink-0', align: 'center', cell: (index) => index.unique ? 'Yes' : 'No' },
    {
      key: 'actions', header: 'Actions', className: 'w-32 shrink-0', align: 'right',
      cell: (index) => index.readOnly ? 'Read-only' : (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            prefix={<Icon name="edit" size="sm" />}
            title="Edit index"
            aria-label={`Edit index ${index.name}`}
            disabled={busy || Boolean(draft)}
            onClick={() => setDraft({ ...index, original: index })}
          />
          <Button
            size="sm"
            variant="ghost"
            prefix={<Icon name="trash" size="sm" />}
            title="Delete index"
            aria-label={`Delete index ${index.name}`}
            disabled={busy || Boolean(draft)}
            onClick={() => request({ operation: 'delete', original: index })}
          />
        </div>
      ),
    },
  ];
  const available = table.columns.map(({ name }) => ({ value: name, label: name }));
  const updateDraftColumns = (names: string[]) => setDraft((current) => current && { ...current, columns: names });
  const applyIndex = () => {
    if (busy || !draft?.name.trim()) return;
    const index = { name: draft.name.trim(), columns: draft.columns, unique: draft.unique };
    request(draft.original ? { operation: 'update', original: draft.original, index } : { operation: 'create', index });
  };

  return (
    <section aria-label="Indexes" aria-busy={busy} className="flex min-w-0 flex-col gap-2 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>Index changes are applied separately from column changes.</span>
        <div className="flex gap-1">
          <Button variant="secondary" disabled={busy || Boolean(draft)} onClick={() => request()}>Reload</Button>
          <Button variant="secondary" disabled={busy || !indexes || Boolean(draft) || !available.length}
            onClick={() => setDraft({ name: '', columns: [available[0].value], unique: false })}>Add Index</Button>
        </div>
      </div>
      <DataList ariaLabel="Indexes" columns={columns} entries={indexes ?? []} entryKey={(index) => index.name}
        scrollBodyOnly className="max-h-48 flex-none bg-transparent"
        emptyMessage={busy ? 'Loading indexes...' : indexes ? 'No indexes.' : 'Indexes unavailable.'} />
      {draft && (
        <Dialog
          open
          onOpenChange={(nextOpen) => { if (!nextOpen) setDraft(undefined); }}
          title={draft.original ? 'Edit Index' : 'Add Index'}
          className="w-120"
          form="index-draft-form"
          saveLabel="Apply Index"
          saveDisabled={!draft.name.trim()}
          pending={busy}
        >
          <Form id="index-draft-form" onSubmit={(event) => event.stopPropagation()} onFormSubmit={applyIndex}>
            <fieldset disabled={busy} className="flex flex-col gap-2">
              <FormItem name="name" label="Index Name">
                <Input placeholder="Index name" value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </FormItem>
              <fieldset className="min-w-0">
                <legend className="mb-1 font-medium">Columns</legend>
                <div className="flex max-h-40 flex-col gap-1 overflow-auto">
                  {draft.columns.map((name, position) => (
                    <div key={position} className="flex items-center gap-1">
                      <span className="w-6 shrink-0">{position + 1}.</span>
                      <Select ariaLabel={`Index column ${position + 1}`} value={name} disabled={busy}
                        options={available.filter((option) => option.value === name || !draft.columns.includes(option.value))}
                        onValueChange={(value) => {
                          if (value) updateDraftColumns(draft.columns.map((column, index) => index === position ? value : column));
                        }} />
                      <Button
                        size="sm"
                        variant="ghost"
                        prefix={<Icon name="arrow-up" size="sm" />}
                        title="Move column up"
                        aria-label={`Move column ${name} up`}
                        disabled={busy || position === 0}
                        onClick={() => {
                          const next = [...draft.columns];
                          [next[position - 1], next[position]] = [next[position], next[position - 1]];
                          updateDraftColumns(next);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        prefix={<Icon name="trash" size="sm" />}
                        title="Remove column"
                        aria-label={`Remove column ${name}`}
                        disabled={busy || draft.columns.length === 1}
                        onClick={() => updateDraftColumns(draft.columns.filter((_, index) => index !== position))}
                      />
                    </div>
                  ))}
                </div>
                <Button variant="secondary" disabled={busy || draft.columns.length >= available.length} onClick={() => {
                  const next = available.find(({ value }) => !draft.columns.includes(value));
                  if (next) updateDraftColumns([...draft.columns, next.value]);
                }} className="mt-2">Add Column</Button>
              </fieldset>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <Checkbox checked={draft.unique} disabled={busy} onCheckedChange={(unique) => setDraft({ ...draft, unique })} />
                  <span>Unique</span>
                </label>
              </div>
            </fieldset>
          </Form>
        </Dialog>
      )}
    </section>
  );
}
