import { useCallback, useMemo, useState } from 'react';
import type { ChatData } from '@/features/chat/protocol';
import { Button } from '@/webview/components/ui/button';
import { Empty } from '@/webview/components/ui/empty';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { List, type ListGroup, type ListItem } from '@/webview/components/ui/list';
import { Popover } from '@/webview/components/ui/popover';
import { getDateGroup } from '@/webview/utils/date-groups';

type ChatHistoryEntry = ChatData['history'][number];

interface ChatHistoryProps {
  history: ChatData['history'];
  activeId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function toChatHistoryGroups(
  history: readonly ChatHistoryEntry[],
  disabled: boolean | undefined,
  onDelete: (id: string) => void,
): ListGroup<ChatHistoryEntry>[] {
  const groups = new Map<string, { label: string; items: ListItem<ChatHistoryEntry>[] }>();

  for (const entry of history) {
    const timestamp = Number(entry.id);
    const validTimestamp = Number.isFinite(timestamp);
    const dateGroup = getDateGroup(validTimestamp ? timestamp : Date.now());
    let group = groups.get(dateGroup.key);
    if (!group) {
      group = { label: dateGroup.label, items: [] };
      groups.set(dateGroup.key, group);
    }

    group.items.push({
      key: entry.id,
      data: entry,
      label: (
        <span title={entry.title} className="truncate">
          {entry.title}
        </span>
      ),
      actions: (
        <Button
          variant="ghost"
          size="sm"
          title="Delete chat"
          aria-label={`Delete ${entry.title}`}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            if (!disabled) onDelete(entry.id);
          }}
          prefix={<Icon name="trash" />}
        />
      ),
    });
  }

  return Array.from(groups, ([key, group]) => ({
    key,
    label: group.label,
    items: group.items,
  }));
}

export function ChatHistory({ history, activeId, disabled, onSelect, onDelete }: ChatHistoryProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredHistory = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return history;
    return history.filter((entry) => entry.title.toLowerCase().includes(term));
  }, [history, query]);

  const groups = useMemo(
    () => toChatHistoryGroups(filteredHistory, disabled, onDelete),
    [filteredHistory, disabled, onDelete],
  );

  const handleSelect = useCallback(
    (entry: ChatHistoryEntry) => {
      if (disabled) return;
      onSelect(entry.id);
      setOpen(false);
    },
    [disabled, onSelect],
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery('');
      }}
      trigger={
        <Button size="lg" variant="ghost" title="Chat history" aria-label="Chat history">
          <Icon name="menu" />
        </Button>
      }
      className="w-64 max-w-(--available-width) text-xs p-1"
    >
      <div className="border-b border-(--vscode-panel-border) p-1">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats"
          aria-label="Search chats"
          prefix={<Icon name="search" size="sm" variant="muted" />}
          autoFocus
        />
      </div>
      {history.length === 0 ? (
        <div className="text-sm">
          <Empty title="No chats yet" description="Chats you start will appear here." icon="history" />
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-sm">
          <Empty title="No matching chats" description="Try a different search term." icon="search" />
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto overscroll-contain p-1">
          <List
            ariaLabel="Chat history"
            groups={groups}
            selectedKey={activeId}
            onActivate={handleSelect}
            onItemClick={handleSelect}
          />
        </div>
      )}
    </Popover>
  );
}
