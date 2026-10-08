import { useState } from 'react';
import type { HttpResponseData } from '@/features/http/protocol';
import { SegmentedControl } from '@/webview/components/segmented-control';
import { formatSize } from '@/webview/utils/format';
import { HttpHeaders } from './http-headers';
import { ResultText } from '../result-text';

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
    <div className="flex min-w-0 flex-col gap-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
          <span className="shrink-0 font-mono font-semibold">{response.request.method}</span>
          <span className="min-w-0 truncate font-mono select-text" title={response.request.url}>
            {response.request.url}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-xs">
          <span className={statusColorClass}>
            {response.status} {response.statusText}
          </span>
          <span className="text-(--vscode-descriptionForeground)">{formatSize(response.sizeBytes)}</span>
        </div>
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
      <HttpHeaders headers={headers} />
      <ResultText
        title={side === 'request' ? 'Request body' : 'Response body'}
        content={body ?? ''}
        language={side === 'response' && response.isJson ? 'json' : undefined}
      />
    </div>
  );
}
