import type { ChatMessage as ChatMessageData } from '@/features/chat/protocol';
import { memo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Button } from '@/webview/components/ui/button';
import { CopyButton } from '@/webview/components/copy-button';
import { Icon } from '@/webview/components/ui/icons';
import { ChatTokenUsage } from '@/webview/pages/chat/components/chat-token-usage';

interface ChatMessageProps {
  message: ChatMessageData;
  index: number;
  generating?: boolean;
  onCopy: (index: number) => void;
  onEdit?: (content: string, index: number) => void;
  onRegenerate?: () => void;
}

export const ChatMessage = memo(
  function ChatMessage({ message, index, generating = false, onCopy, onEdit, onRegenerate }: ChatMessageProps) {
    const user = message.role === 'user';

    return (
      <article
        aria-label={user ? 'Your message' : 'AI message'}
        aria-busy={generating || undefined}
        className={user ? 'relative flex w-full min-w-0 justify-end pl-8' : 'relative w-full min-w-0 pr-4 sm:pr-8'}
      >
        <div className="min-w-0">
          <div
            className={
              user
                ? 'min-w-0 rounded-md border border-(--vscode-panel-border) bg-(--vscode-textBlockQuote-background) px-3 py-2'
                : 'min-w-0'
            }
          >
            <div className="min-w-0 space-y-3 wrap-anywhere leading-relaxed [&_.katex-display]:my-3 [&_.katex-display]:block [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1">
              <Markdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[[rehypeKatex, { output: 'mathml', trust: false, strict: 'ignore' }]]}
                skipHtml
                components={{
                  p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                  h1: ({ children }) => <h1 className="mt-4 text-xl font-semibold">{children}</h1>,
                  h2: ({ children }) => <h2 className="mt-4 text-lg font-semibold">{children}</h2>,
                  h3: ({ children }) => <h3 className="mt-3 text-base font-semibold">{children}</h3>,
                  h4: ({ children }) => <h4 className="mt-3 font-semibold">{children}</h4>,
                  h5: ({ children }) => <h5 className="mt-3 font-semibold">{children}</h5>,
                  h6: ({ children }) => <h6 className="mt-3 font-semibold">{children}</h6>,
                  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
                  ol: ({ children, start }) => (
                    <ol start={start} className="list-decimal space-y-1 pl-5">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="space-y-1">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="space-y-2 border-l-2 border-(--vscode-textBlockQuote-border) bg-(--vscode-textBlockQuote-background) px-3 py-2 text-(--vscode-descriptionForeground)">
                      {children}
                    </blockquote>
                  ),
                  pre: ({ children }) => (
                    <pre className="max-w-full overflow-x-auto rounded-md border border-(--vscode-panel-border) bg-(--vscode-textCodeBlock-background) p-3 text-xs leading-5 [&>code]:whitespace-pre [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit">
                      {children}
                    </pre>
                  ),
                  code: ({ children, className }) => (
                    <code
                      className={`rounded-sm bg-(--vscode-textCodeBlock-background) px-1 font-mono text-(--vscode-textPreformat-foreground) ${className ?? ''}`}
                    >
                      {children}
                    </code>
                  ),
                  a: ({ children, href, title }) => (
                    <a
                      href={href}
                      title={title}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-(--vscode-textLink-foreground) underline underline-offset-2 hover:text-(--vscode-textLink-activeForeground)"
                    >
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div className="max-w-full overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-(--vscode-panel-border) bg-(--vscode-textBlockQuote-background) px-2 py-1 font-semibold">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-(--vscode-panel-border) px-2 py-1 align-top">{children}</td>
                  ),
                  hr: () => <hr className="border-(--vscode-panel-border)" />,
                  input: ({ checked }) => (
                    <input
                      type="checkbox"
                      checked={checked ?? false}
                      disabled
                      aria-label="Task status"
                      className="mr-1 align-middle"
                    />
                  ),
                  img: ({ alt }) => <span className="text-(--vscode-descriptionForeground)">{alt || 'Image'}</span>,
                }}
              >
                {message.content}
              </Markdown>
            </div>
          </div>
          {user && (
            <footer className="mt-1 flex justify-end items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                title="Edit and resend"
                aria-label="Edit and resend"
                disabled={!onEdit}
                onClick={() => onEdit?.(message.content, index)}
              >
                <Icon name="edit" />
              </Button>
              <CopyButton
                size="sm"
                title="Copy message"
                copiedTitle="Copied"
                disabled={!message.content}
                onCopy={() => onCopy(index)}
              />
            </footer>
          )}
          {!user && (
            <footer className="mt-1 flex min-h-6 flex-wrap items-center gap-2 text-xs text-(--vscode-descriptionForeground)">
              {generating ? (
                <div role="status" className="flex items-center gap-1">
                  <Icon name="loading" size="sm" className="animate-spin" />
                  <span>Responding...</span>
                </div>
              ) : (
                <ChatTokenUsage message={message} />
              )}
              <div className="flex items-center">
                {onRegenerate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Regenerate response"
                    aria-label="Regenerate response"
                    disabled={generating}
                    onClick={onRegenerate}
                  >
                    <Icon name="refresh" />
                  </Button>
                )}
                <CopyButton
                  size="sm"
                  title="Copy message"
                  copiedTitle="Copied"
                  disabled={!message.content}
                  onCopy={() => onCopy(index)}
                />
              </div>
            </footer>
          )}
        </div>
      </article>
    );
  },
  (previous, next) =>
    previous.message.role === next.message.role &&
    previous.message.content === next.message.content &&
    previous.message.inputTokens === next.message.inputTokens &&
    previous.message.outputTokens === next.message.outputTokens &&
    previous.index === next.index &&
    previous.generating === next.generating &&
    !!previous.onRegenerate === !!next.onRegenerate &&
    previous.onCopy === next.onCopy &&
    previous.onEdit === next.onEdit &&
    previous.onRegenerate === next.onRegenerate,
);
