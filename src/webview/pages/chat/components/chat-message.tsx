import type { ChatMessage as ChatMessageData } from '@/features/chat/protocol';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';

interface ChatMessageProps {
  message: ChatMessageData;
  generating?: boolean;
  onCopy: () => void;
}

export function ChatMessage({ message, generating = false, onCopy }: ChatMessageProps) {
  const user = message.role === 'user';
  const tokens =
    typeof message.outputTokens === 'number' && Number.isFinite(message.outputTokens)
      ? `${message.outputTokens.toLocaleString()} output tokens`
      : 'Token count unavailable';

  return (
    <article
      aria-label={user ? 'Your message' : 'AI message'}
      aria-busy={generating || undefined}
      className={user ? 'flex w-full min-w-0 justify-end pl-8' : 'w-full min-w-0 pr-4 sm:pr-8'}
    >
      <div
        className={
          user
            ? 'min-w-0 max-w-full rounded-md bg-(--vscode-textBlockQuote-background) px-3 py-2'
            : 'min-w-0 max-w-full'
        }
      >
        <div className="whitespace-pre-wrap wrap-anywhere leading-relaxed">{message.content}</div>
        {!user && (
          <footer className="mt-1 flex min-h-6 flex-wrap items-center gap-2 text-xs text-(--vscode-descriptionForeground)">
            {generating ? (
              <div role="status" className="flex items-center gap-1">
                <Icon name="loading" size="sm" className="animate-spin" />
                <span>Responding...</span>
              </div>
            ) : (
              <span title="Reply text token count, not billing usage">{tokens}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              title="Copy message"
              aria-label="Copy message"
              disabled={!message.content}
              onClick={onCopy}
            >
              <Icon name="copy" size="sm" />
            </Button>
          </footer>
        )}
      </div>
    </article>
  );
}
