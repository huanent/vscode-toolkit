import type { ChatMessage } from '@/features/chat/protocol';

const unavailable = '—';

function format(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : unavailable;
}

const description = 'Input tokens are the prompt sent with this request, counted with the model tokenizer.';

export function ChatTokenUsage({ message }: { message: ChatMessage }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 tabular-nums" title={description}>
      <span>in {format(message.inputTokens)}</span>
      <span aria-hidden="true">·</span>
      <span>out {format(message.outputTokens)}</span>
      <span aria-hidden="true">Tokens</span>
    </span>
  );
}
