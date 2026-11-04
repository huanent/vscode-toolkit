import { useState } from 'react';
import type { ChatPromptTemplate } from '@/features/chat/protocol';
import { Button } from '@/webview/components/ui/button';
import { Dialog } from '@/webview/components/ui/dialog';
import { Empty } from '@/webview/components/ui/empty';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { List } from '@/webview/components/ui/list';
import { Popover } from '@/webview/components/ui/popover';
import { Textarea } from '@/webview/components/ui/textarea';

interface ChatPromptsProps {
  templates: ChatPromptTemplate[];
  systemPrompt: string;
  onInsert: (content: string) => void;
  onSave: (template: ChatPromptTemplate) => void;
  onDelete: (id: string) => void;
  onSaveSystem: (content: string) => void;
}

export function ChatPrompts({ templates, systemPrompt, onInsert, onSave, onDelete, onSaveSystem }: ChatPromptsProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChatPromptTemplate>();
  const [systemOpen, setSystemOpen] = useState(false);
  const [system, setSystem] = useState('');
  const select = (template: ChatPromptTemplate) => {
    onInsert(template.content);
    setOpen(false);
  };
  return (
    <>
      <Button
        variant="ghost"
        title="Edit system prompt"
        aria-label="Edit system prompt"
        onClick={() => {
          setSystem(systemPrompt);
          setSystemOpen(true);
        }}
      >
        <Icon name="settings-gear" />
      </Button>
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button variant="ghost" title="Prompt templates" aria-label="Prompt templates">
            <Icon name="symbol-snippet" />
          </Button>
        }
        className="w-64 max-w-(--available-width) text-xs p-1"
      >
        <div className="flex items-center justify-between border-b border-(--vscode-panel-border) p-1">
          <span className="font-semibold">Prompt templates</span>
          <Button
            variant="ghost"
            size="sm"
            title="Add template"
            aria-label="Add template"
            onClick={() => {
              setOpen(false);
              setEditing({ id: crypto.randomUUID(), name: '', content: '' });
            }}
          >
            <Icon name="add" />
          </Button>
        </div>
        {templates.length === 0 ? (
          <Empty title="No templates yet" icon="symbol-snippet" />
        ) : (
          <div className="max-h-80 overflow-y-auto overscroll-contain p-1">
            <List
              ariaLabel="Prompt templates"
              items={templates.map((template) => ({
                key: template.id,
                data: template,
                label: (
                  <span className="truncate" title={template.name}>
                    {template.name}
                  </span>
                ),
                actions: (
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Edit template"
                      aria-label={`Edit ${template.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpen(false);
                        setEditing({ ...template });
                      }}
                    >
                      <Icon name="edit" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete template"
                      aria-label={`Delete ${template.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(template.id);
                      }}
                    >
                      <Icon name="trash" />
                    </Button>
                  </div>
                ),
              }))}
              onActivate={select}
              onItemClick={select}
            />
          </div>
        )}
      </Popover>
      <Dialog
        open={!!editing}
        onOpenChange={(next) => {
          if (!next) setEditing(undefined);
        }}
        title={templates.some((item) => item.id === editing?.id) ? 'Edit template' : 'New template'}
        saveDisabled={!editing?.name.trim() || !editing.content.trim()}
        onSave={() => {
          if (editing) onSave({ ...editing, name: editing.name.trim() });
          setEditing(undefined);
        }}
      >
        <div className="flex flex-col gap-3 py-2">
          <label className="flex flex-col gap-1">
            Name
            <Input
              value={editing?.name ?? ''}
              onChange={(event) => setEditing((current) => current && { ...current, name: event.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            Content
            <Textarea
              rows={8}
              value={editing?.content ?? ''}
              onChange={(event) => setEditing((current) => current && { ...current, content: event.target.value })}
            />
          </label>
        </div>
      </Dialog>
      <Dialog
        open={systemOpen}
        onOpenChange={setSystemOpen}
        title="System prompt"
        onSave={() => {
          onSaveSystem(system);
          setSystemOpen(false);
        }}
      >
        <label className="flex flex-col gap-1 py-2">
          Content
          <Textarea rows={10} value={system} onChange={(event) => setSystem(event.target.value)} />
        </label>
      </Dialog>
    </>
  );
}
