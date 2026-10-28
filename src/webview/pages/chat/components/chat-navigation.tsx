import type { ChatMessage } from '@/features/chat/protocol';

interface ChatNavigationProps {
  messages: ChatMessage[];
  activeAnchor?: number;
  onNavigate: (index: number) => void;
}

export function ChatNavigation({ messages, activeAnchor, onNavigate }: ChatNavigationProps) {
  if (!messages.some((message) => message.role === 'user')) return null;

  return (
    <nav aria-label="Message navigation" className="absolute inset-y-0 -left-2 z-10 flex flex-col overflow-y-auto">
      <div className="my-auto flex flex-col">
        {messages.map((message, index) =>
          message.role === 'user' ? (
            <button
              key={index}
              type="button"
              title={message.content.trim() || 'Your message'}
              aria-label={`Go to message ${index + 1}: ${message.content.trim().slice(0, 100)}`}
              aria-current={activeAnchor === index ? 'location' : undefined}
              className="group flex h-4 w-4 shrink-0 items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-(--vscode-focusBorder)"
              onClick={() => onNavigate(index)}
            >
              <span
                className={
                  activeAnchor === index
                    ? 'h-2 w-1 rounded-full bg-(--vscode-textLink-foreground) transition-all'
                    : 'size-1 rounded-full bg-(--vscode-descriptionForeground) transition-all group-hover:scale-150 group-hover:bg-(--vscode-textLink-foreground) group-focus-visible:scale-150 group-focus-visible:bg-(--vscode-textLink-foreground)'
                }
              />
            </button>
          ) : null,
        )}
      </div>
    </nav>
  );
}
