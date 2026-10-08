import { useState } from 'react';
import type { HttpResponseData } from '@/features/http/protocol';
import { SegmentedControl } from '@/webview/components/segmented-control';
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
            <SegmentedControl
              ariaLabel="HTTP message"
              value={side}
              onValueChange={setSide}
              options={[
                { value: 'request', label: 'Request' },
                { value: 'response', label: 'Response' },
              ]}
            />
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
