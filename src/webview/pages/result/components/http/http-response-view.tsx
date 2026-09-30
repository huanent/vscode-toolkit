import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { useState } from 'react';
import type { HttpResponseData } from '@/features/http/protocol';
import { formatSize } from '@/webview/utils/format';
import { HttpHeaders } from './http-headers';

interface HttpResponseViewProps {
  response: HttpResponseData;
}

export function HttpResponseView({ response }: HttpResponseViewProps) {
  const [side, setSide] = useState<'request' | 'response'>('response');
  const statusColorClass =
    response.status >= 200 && response.status < 300
      ? 'text-(--vscode-testing-iconPassed)'
      : response.status >= 300 && response.status < 400
        ? 'text-(--vscode-editorWarning-foreground)'
        : 'text-(--vscode-editorError-foreground)';

  const displayBody = response.formattedBody ?? response.body;
  const headers = side === 'request' ? response.request.headers : response.headers;
  const body = side === 'request' ? response.request.body : displayBody;

  return (
    <div className="flex flex-col gap-3 px-4">
      <HttpHeaders
        headers={headers}
        action={
          <div className="flex items-center gap-2">
            {side === 'response' && (
              <span className="flex items-center gap-2 font-mono text-xs font-normal">
                <span className="text-(--vscode-descriptionForeground)">Status:</span>
                <span className={statusColorClass}>
                  {response.status} {response.statusText}
                </span>
                <span className="text-(--vscode-descriptionForeground)">·</span>
                <span className="text-(--vscode-descriptionForeground)">Size:</span>
                <span className="text-(--vscode-foreground)">{formatSize(response.sizeBytes)}</span>
              </span>
            )}
            <ToggleGroup
              aria-label="HTTP message"
              value={[side]}
              onValueChange={(value) => {
                if (value[0] === 'request' || value[0] === 'response') setSide(value[0]);
              }}
              className="flex shrink-0 items-center rounded border border-(--vscode-panel-border) p-px"
            >
              <Toggle
                value="request"
                className="cursor-pointer rounded px-2 py-1 text-xs text-(--vscode-foreground) hover:bg-(--vscode-list-hoverBackground) data-pressed:bg-(--vscode-list-activeSelectionBackground) data-pressed:text-(--vscode-list-activeSelectionForeground) focus-visible:outline-1 focus-visible:outline-(--vscode-focusBorder)"
              >
                Request
              </Toggle>
              <Toggle
                value="response"
                className="cursor-pointer rounded px-2 py-1 text-xs text-(--vscode-foreground) hover:bg-(--vscode-list-hoverBackground) data-pressed:bg-(--vscode-list-activeSelectionBackground) data-pressed:text-(--vscode-list-activeSelectionForeground) focus-visible:outline-1 focus-visible:outline-(--vscode-focusBorder)"
              >
                Response
              </Toggle>
            </ToggleGroup>
          </div>
        }
      />

      <section className="flex flex-col gap-2 pb-4">
        {body ? (
          <pre className="bg-(--vscode-editor-background) p-3 font-mono text-xs leading-relaxed text-(--vscode-editor-foreground) select-text whitespace-pre-wrap break-all rounded-md">
            {body}
          </pre>
        ) : (
          <div className="p-3 text-sm text-(--vscode-descriptionForeground)">Empty {side} body</div>
        )}
      </section>
    </div>
  );
}
