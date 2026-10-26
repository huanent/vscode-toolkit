import { useState } from 'react';
import type { ChatData } from '@/features/chat/protocol';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { List, type ListGroup } from '@/webview/components/ui/list';
import { Popover } from '@/webview/components/ui/popover';
import { getDateGroup } from '@/webview/utils/date-groups';

interface ChatHistoryProps {
  history: ChatData['history'];
  activeId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ChatHistory({ history, activeId, disabled, onSelect, onDelete }: ChatHistoryProps) {
  const [open, setOpen] = useState(false);
  const groups = new Map<string, ListGroup<ChatData['history'][number]>>();
  for (const entry of history) {
    const dateGroup = getDateGroup(Number(entry.id));
    const group = groups.get(dateGroup.key) ?? { ...dateGroup, items: [] };
    group.items = [
      ...group.items,
      {
        key: entry.id,
        data: entry,
        label: <span title={entry.title}>{entry.title}</span>,
        actions: (
          <Button
            variant="ghost"
            size="sm"
            title="Delete chat"
            aria-label={`Delete ${entry.title}`}
            disabled={disabled}
            onClick={() => onDelete(entry.id)}
            prefix={<Icon name="trash" />}
          />
        ),
      },
    ];
    groups.set(dateGroup.key, group);
  }

  function select(entry: ChatData['history'][number]): void {
    if (disabled) return;
    onSelect(entry.id);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button size="lg" variant="ghost" title="Recent chats" aria-label="Recent chats">
          <Icon name="menu" />
        </Button>
      }
      className="w-72 max-w-(--available-width)"
    >
      <div className="border-b border-(--vscode-panel-border) px-3 py-2 font-semibold">Recent chats</div>
      <div className="max-h-80 overflow-y-auto p-1">
        {history.length === 0 && <div className="p-2 text-(--vscode-descriptionForeground)">No chats yet</div>}
        <List
          ariaLabel="Chat history"
          groups={Array.from(groups.values())}
          selectedKey={activeId}
          onActivate={select}
          onItemClick={select}
        />
      </div>
    </Popover>
  );
}
