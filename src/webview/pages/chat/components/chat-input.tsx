import { useEffect, useRef, useState } from 'react';
import type { ChatData } from '@/features/chat/protocol';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { Textarea } from '@/webview/components/ui/textarea';
import { ModelSelector } from '@/webview/pages/chat/components/model-selector';

interface ChatInputProps {
  chatId: string;
  models: ChatData['models'];
  modelId: string;
  busy: boolean;
  canStop: boolean;
  sendError: boolean;
  onModelChange: (value: string) => void;
  onSend: (content: string) => void;
  onStop: () => void;
}

export function ChatInput({
  chatId,
  models,
  modelId,
  busy,
  canStop,
  sendError,
  onModelChange,
  onSend,
  onStop,
}: ChatInputProps) {
  const [draft, setDraft] = useState('');
  const submitted = useRef('');
  const previousChatId = useRef(chatId);
  useEffect(() => {
    if (previousChatId.current && previousChatId.current !== chatId) setDraft('');
    previousChatId.current = chatId;
  }, [chatId]);
  useEffect(() => {
    if (!busy && sendError && submitted.current) {
      setDraft((current) => current || submitted.current);
      submitted.current = '';
    } else if (canStop) {
      submitted.current = '';
    }
  }, [busy, canStop, sendError]);
  const canSend = !busy && !!draft.trim() && !!modelId;

  function send(): void {
    if (!canSend) return;
    submitted.current = draft;
    onSend(draft.trim());
    setDraft('');
  }

  return (
    <form
      className="overflow-hidden rounded-lg border border-(--vscode-input-border,var(--vscode-panel-border)) bg-(--vscode-input-background) focus-within:border-(--vscode-focusBorder)"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <Textarea
        aria-label="Message"
        placeholder="Message..."
        value={draft}
        rows={1}
        className="block field-sizing-content h-auto min-h-9 max-h-40 w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 leading-5 focus-visible:outline-none"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
      />
      <div className="flex min-h-8 min-w-0 items-center justify-between gap-2 px-2 pb-1">
        <ModelSelector models={models} value={modelId} disabled={busy} onValueChange={onModelChange} />
        {busy ? (
          <Button
            variant="secondary"
            title="Stop generating"
            aria-label="Stop generating"
            disabled={!canStop}
            className="rounded-full"
            onClick={onStop}
          >
            <Icon name="debug-stop" />
          </Button>
        ) : (
          <Button
            type="submit"
            title="Send message"
            aria-label="Send message"
            className="rounded-full"
            disabled={!canSend}
          >
            <Icon name="arrow-up" />
          </Button>
        )}
      </div>
    </form>
  );
}
