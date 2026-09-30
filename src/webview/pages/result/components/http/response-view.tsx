import { useState } from 'react';
import type { HttpResponseData } from '@/features/http/protocol';
import { HeadersTable } from './headers-table';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Tabs, TabPanel, type Tab } from '@/webview/components/tabs';
import { postToHost } from '@/webview/utils/host-data';
import { Header } from '@/webview/components/header';

interface ResponseViewProps {
  response: HttpResponseData;
}

const tabs: Tab[] = [
  { id: 'body', label: 'Body' },
  { id: 'headers', label: 'Headers' },
  { id: 'request', label: 'Request' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResponseView({ response }: ResponseViewProps) {
  const [activeTab, setActiveTab] = useState('body');

  const statusColorClass =
    response.status >= 200 && response.status < 300
      ? 'text-(--vscode-testing-iconPassed)'
      : response.status >= 300 && response.status < 400
        ? 'text-(--vscode-editorWarning-foreground)'
        : 'text-(--vscode-editorError-foreground)';

  const displayBody = response.formattedBody ?? response.body;

  const handleCopyBody = () => {
    postToHost({ type: 'copyToClipboard', text: displayBody });
  };

  const handleOpenEditor = () => {
    postToHost({
      type: 'openInEditor',
      content: displayBody,
      language: response.isJson ? 'json' : 'text',
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Header>
        <span className="font-mono text-xs uppercase px-1 py-0.5 rounded bg-(--vscode-badge-background) text-(--vscode-badge-foreground)">
          {response.request.method}
        </span>
        <span className="font-mono text-xs break-all text-(--vscode-foreground)">{response.request.url}</span>
      </Header>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-1">
          <span className="text-(--vscode-descriptionForeground)">Status:</span>
          <span className={statusColorClass}>
            {response.status} {response.statusText}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-(--vscode-descriptionForeground)">Time:</span>
          <span className="text-(--vscode-foreground)">{response.durationMs} ms</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-(--vscode-descriptionForeground)">Size:</span>
          <span className="text-(--vscode-foreground)">{formatBytes(response.sizeBytes)}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTabId={activeTab} onChange={setActiveTab}>
        <div className="py-2">
          <TabPanel tabId="body">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={handleCopyBody}>
                  <Icon name="copy" size="sm" />
                  <span>Copy</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleOpenEditor}>
                  <Icon name="link-external" size="sm" />
                  <span>Open in Editor</span>
                </Button>
              </div>

              {displayBody ? (
                <pre className="max-h-125 overflow-auto rounded border border-(--vscode-panel-border) bg-(--vscode-editor-background) p-3 font-mono text-xs leading-relaxed text-(--vscode-editor-foreground) select-text whitespace-pre-wrap break-all">
                  {displayBody}
                </pre>
              ) : (
                <div className="p-3 text-sm text-(--vscode-descriptionForeground)">Empty response body</div>
              )}
            </div>
          </TabPanel>

          <TabPanel tabId="headers">
            <HeadersTable headers={response.headers} />
          </TabPanel>

          <TabPanel tabId="request">
            <div className="flex flex-col gap-3">
              <div>
                <h4 className="mb-1 text-xs font-semibold text-(--vscode-descriptionForeground)">Request Headers</h4>
                <HeadersTable headers={response.request.headers} />
              </div>

              {response.request.body && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold text-(--vscode-descriptionForeground)">Request Body</h4>
                  <pre className="max-h-75 overflow-auto rounded border border-(--vscode-panel-border) bg-(--vscode-editor-background) p-3 font-mono text-xs leading-relaxed text-(--vscode-editor-foreground) select-text whitespace-pre-wrap break-all">
                    {response.request.body}
                  </pre>
                </div>
              )}
            </div>
          </TabPanel>
        </div>
      </Tabs>
    </div>
  );
}
