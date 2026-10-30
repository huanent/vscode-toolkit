import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from '@/webview/components/ui/button';
import { Combobox } from '@/webview/components/ui/combobox';
import { DataList, type DataListColumn } from '@/webview/components/ui/data-list';
import { Dialog } from '@/webview/components/ui/dialog';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { Textarea } from '@/webview/components/ui/textarea';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import type { CustomCommand, CustomCommandHostMessage, CustomCommandWebviewMessage } from '@/features/custom/protocol';
import '@/webview/styles.css';

type DraftStep = { command: string; args: string };

function App() {
  const [error, setError] = useState('');
  const host = useHostData<CustomCommand[], CustomCommandHostMessage>((message, state) => {
    if (message.type === 'updated') return { status: 'loaded', data: message.commands };
    if (message.type === 'error') setError(message.message);
    return state;
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomCommand | undefined>();
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [availableCommands, setAvailableCommands] = useState<string[]>([]);
  const send = (message: CustomCommandWebviewMessage) => postToHost(message);
  const edit = (command?: CustomCommand) => {
    setEditing(command);
    setName(command?.name ?? '');
    setSteps(
      command?.steps.map((step) => ({ command: step.command, args: JSON.stringify(step.args) })) ?? [
        { command: '', args: '[]' },
      ],
    );
    setError('');
    setOpen(true);
    send({ type: 'listAvailableCommands' });
  };
  useEffect(() => {
    const listener = (event: MessageEvent<CustomCommandHostMessage>) => {
      if (event.data?.type === 'add') edit();
      else if (event.data?.type === 'availableCommands') setAvailableCommands(event.data.commands);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);
  const save = () => {
    try {
      const parsed = steps.map((step) => {
        const args: unknown = JSON.parse(step.args);
        if (!Array.isArray(args) || !step.command.trim())
          throw new Error('Each step requires a command ID and a JSON array of arguments.');
        return { command: step.command.trim(), args };
      });
      if (!name.trim() || !parsed.length) throw new Error('A name and at least one step are required.');
      send({ type: 'save', command: { id: editing?.id ?? '', name: name.trim(), steps: parsed } });
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };
  const columns: DataListColumn<CustomCommand>[] = [
    { key: 'name', header: 'Name', className: 'flex-1 truncate', cell: (row) => row.name },
    { key: 'steps', header: 'Steps', className: 'w-20', cell: (row) => row.steps.length },
    { key: 'id', header: 'ID', className: 'w-72 truncate', cell: (row) => row.id },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-36',
      align: 'right',
      cell: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            title="Run"
            aria-label="Run"
            prefix={<Icon name="play" />}
            onClick={() => send({ type: 'run', id: row.id })}
          />
          <Button
            variant="ghost"
            size="sm"
            title="Configure keyboard shortcut"
            aria-label="Configure keyboard shortcut"
            prefix={<Icon name="keyboard" />}
            onClick={() => send({ type: 'shortcuts', id: row.id })}
          />
          <Button
            variant="ghost"
            size="sm"
            title="Edit"
            aria-label="Edit"
            prefix={<Icon name="edit" />}
            onClick={() => edit(row)}
          />
          <Button
            variant="ghost"
            size="sm"
            title="Delete"
            aria-label="Delete"
            prefix={<Icon name="trash" />}
            onClick={() => send({ type: 'delete', id: row.id })}
          />
        </div>
      ),
    },
  ];
  return (
    <div className="flex h-screen flex-col">
      {error && !open && (
        <div role="alert" className="px-4 py-2 text-(--vscode-errorForeground)">
          {error}
        </div>
      )}
      <DataList
        ariaLabel="Commands"
        columns={columns}
        entries={host.status === 'loaded' ? host.data : []}
        entryKey={(row) => row.id}
        onOpen={edit}
        emptyMessage="No custom commands."
      />
      <Dialog open={open} onOpenChange={setOpen} title={editing ? 'Edit Command' : 'New Command'} onSave={save}>
        <div className="flex flex-col gap-3 py-2">
          <label className="flex flex-col gap-1">
            Name
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          {editing && <div className="break-all text-(--vscode-descriptionForeground)">ID: {editing.id}</div>}
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col gap-2 border-b border-(--vscode-panel-border) pb-3">
              <div className="flex items-center justify-between">
                <span>Step {index + 1}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Move up"
                    aria-label="Move up"
                    disabled={index === 0}
                    prefix={<Icon name="arrow-up" />}
                    onClick={() =>
                      setSteps((current) => {
                        const next = [...current];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        return next;
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Move down"
                    aria-label="Move down"
                    disabled={index === steps.length - 1}
                    prefix={<Icon name="arrow-down" />}
                    onClick={() =>
                      setSteps((current) => {
                        const next = [...current];
                        [next[index + 1], next[index]] = [next[index], next[index + 1]];
                        return next;
                      })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Remove step"
                    aria-label="Remove step"
                    prefix={<Icon name="trash" />}
                    onClick={() => setSteps((current) => current.filter((_, position) => position !== index))}
                  />
                </div>
              </div>
              <label className="flex flex-col gap-1">
                Command ID
                <Combobox
                  ariaLabel="Command ID"
                  options={availableCommands}
                  value={step.command}
                  onValueChange={(value) =>
                    setSteps((current) =>
                      current.map((item, position) => (position === index ? { ...item, command: value } : item)),
                    )
                  }
                  placeholder="workbench.action.files.save"
                />
              </label>
              <label className="flex flex-col gap-1">
                Arguments (JSON array)
                <Textarea
                  rows={2}
                  value={step.args}
                  onChange={(event) =>
                    setSteps((current) =>
                      current.map((item, position) =>
                        position === index ? { ...item, args: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
          <Button
            variant="secondary"
            prefix={<Icon name="add" />}
            onClick={() => setSteps((current) => [...current, { command: '', args: '[]' }])}
          >
            Add Step
          </Button>
          {error && (
            <div role="alert" className="text-(--vscode-errorForeground)">
              {error}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
