import { useEffect, useRef, useState } from 'react';
import type { ChatData } from '@/features/chat/protocol';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { Textarea } from '@/webview/components/ui/textarea';
import { ModelSelector } from '@/webview/pages/chat/components/model-selector';

interface ChatInputProps {
  chatId: string;
  editing?: { index: number; content: string };
  models: ChatData['models'];
  modelId: string;
  busy: boolean;
  canStop: boolean;
  sendError: boolean;
  onModelChange: (value: string) => void;
  onSend: (content: string, index?: number) => void;
  onCancelEdit: () => void;
  onStop: () => void;
}

export function ChatInput({
  chatId,
  editing,
  models,
  modelId,
  busy,
  canStop,
  sendError,
  onModelChange,
  onSend,
  onCancelEdit,
  onStop,
}: ChatInputProps) {
  const [draft, setDraft] = useState('');
  const submitted = useRef('');
  const savedDraft = useRef('');
  const editingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousChatId = useRef(chatId);
  useEffect(() => {
    if (previousChatId.current && previousChatId.current !== chatId) setDraft('');
    previousChatId.current = chatId;
  }, [chatId]);
  useEffect(() => {
    if (editing) {
      if (!editingRef.current) savedDraft.current = draft;
      editingRef.current = true;
      setDraft(editing.content);
      textareaRef.current?.focus();
    } else if (editingRef.current) {
      editingRef.current = false;
      setDraft(savedDraft.current);
    }
  }, [editing]);
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
    onSend(draft.trim(), editing?.index);
    if (editing) onCancelEdit();
    else setDraft('');
  }

  return (
    <form
      className={`overflow-hidden rounded-lg border bg-(--vscode-input-background) focus-within:border-(--vscode-focusBorder) ${editing ? 'border-(--vscode-focusBorder)' : 'border-(--vscode-input-border,var(--vscode-panel-border))'}`}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {editing && (
        <div className="flex items-center justify-between gap-2 border-b border-(--vscode-focusBorder) bg-(--vscode-editor-selectionBackground) px-3 py-1 text-xs">
          <span>Editing message</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Cancel editing"
            aria-label="Cancel editing"
            onClick={onCancelEdit}
          >
            <Icon name="close" />
          </Button>
        </div>
      )}
      <Textarea
        ref={textareaRef}
        aria-label="Message"
        placeholder="Message..."
        value={draft}
        rows={1}
        className="block field-sizing-content h-auto min-h-9 max-h-40 w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 leading-5 focus-visible:outline-none"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape' && editing) {
            event.preventDefault();
            onCancelEdit();
            return;
          }
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
