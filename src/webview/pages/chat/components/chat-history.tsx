import { useState } from 'react';
import type { ChatData } from '@/features/chat/protocol';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { Popover } from '@/webview/components/ui/popover';

interface ChatHistoryProps {
  history: ChatData['history'];
  activeId: string;
  disabled?: boolean;
  onSelect: (id: string) => void;
}

export function ChatHistory({ history, activeId, disabled, onSelect }: ChatHistoryProps) {
  const [open, setOpen] = useState(false);

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
        {history.map((entry) => (
          <button
            key={entry.id}
            type="button"
            disabled={disabled}
            aria-current={entry.id === activeId ? 'page' : undefined}
            title={entry.title}
            className="flex w-full min-w-0 flex-col gap-1 rounded-sm px-2 py-2 text-left hover:bg-(--vscode-list-hoverBackground) aria-current:bg-(--vscode-list-inactiveSelectionBackground) disabled:opacity-50"
            onClick={() => {
              onSelect(entry.id);
              setOpen(false);
            }}
          >
            <span className="w-full truncate">{entry.title}</span>
            <span className="text-xs text-(--vscode-descriptionForeground)">
              {new Date(Number(entry.id)).toLocaleString()}
            </span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
