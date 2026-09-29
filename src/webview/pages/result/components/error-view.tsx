import type { HttpErrorData } from '@/features/http/protocol';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { postToHost } from '@/webview/utils/host-data';

interface ErrorViewProps {
  error: HttpErrorData;
}

export function ErrorView({ error }: ErrorViewProps) {
  const handleRerun = () => {
    postToHost({ type: 'rerunRequest' });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--vscode-panel-border) pb-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="font-mono text-xs uppercase px-1 py-0.5 rounded bg-(--vscode-badge-background) text-(--vscode-badge-foreground)">
            {error.request.method}
          </span>
          <span className="font-mono text-xs break-all text-(--vscode-foreground)">{error.request.url}</span>
        </div>

        <Button variant="secondary" size="sm" onClick={handleRerun}>
          <Icon name="refresh" size="sm" />
          <span>Retry</span>
        </Button>
      </div>

      <div className="rounded border border-(--vscode-inputValidation-errorBorder) bg-(--vscode-inputValidation-errorBackground) p-3 text-xs text-(--vscode-errorForeground)">
        <div className="flex items-center gap-2 font-semibold">
          <Icon name="error" size="sm" />
          <span>Request Failed</span>
        </div>
        <div className="mt-2 font-mono break-all">{error.message}</div>
      </div>
    </div>
  );
}
