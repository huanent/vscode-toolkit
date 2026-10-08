import type { ResultWebviewMessage } from '@/features/result/protocol';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { postToHost } from '@/webview/utils/host-data';
import type { ReactNode } from 'react';

interface ResultTextProps {
  title: string;
  content: string;
  language?: string;
  action?: ReactNode;
  description?: ReactNode;
}

export function ResultText({ title, content, language, action, description }: ResultTextProps) {
  return (
    <section className="min-w-0" aria-label={title}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="shrink-0 text-xs font-semibold">{title}</h3>
          {description && (
            <span className="min-w-0 truncate text-xs text-(--vscode-descriptionForeground)">{description}</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs text-(--vscode-descriptionForeground)">
          {action}
          <Button
            variant="ghost"
            size="sm"
            title={`Copy ${title.toLowerCase()}`}
            aria-label={`Copy ${title.toLowerCase()}`}
            disabled={!content}
            icon={<Icon name="copy" />}
            onClick={() => postToHost({ type: 'copyToClipboard', text: content } satisfies ResultWebviewMessage)}
          />
          <Button
            variant="ghost"
            size="sm"
            title={`Open ${title.toLowerCase()} in editor`}
            aria-label={`Open ${title.toLowerCase()} in editor`}
            disabled={!content}
            icon={<Icon name="go-to-file" />}
            onClick={() =>
              postToHost({
                type: 'openInEditor',
                content,
                language: language ?? 'plaintext',
              } satisfies ResultWebviewMessage)
            }
          />
        </div>
      </div>
      {content ? (
        <pre className="max-h-125 overflow-auto rounded-sm border border-(--vscode-panel-border) bg-(--vscode-editor-background) p-2 font-mono text-xs text-(--vscode-editor-foreground) select-text whitespace-pre-wrap break-words">
          {content}
        </pre>
      ) : (
        <div className="border border-(--vscode-panel-border) p-3 text-xs text-(--vscode-descriptionForeground)">
          Empty {title.toLowerCase()}
        </div>
      )}
    </section>
  );
}
