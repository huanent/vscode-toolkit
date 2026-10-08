import type { HttpErrorData } from '@/features/http/protocol';
import type { ResultTaskStatus } from '@/features/result/protocol';
import { Icon } from '@/webview/components/icons';

interface HttpErrorViewProps {
  error: HttpErrorData;
  status: ResultTaskStatus;
}

export function HttpErrorView({ error, status }: HttpErrorViewProps) {
  const title =
    status === 'cancelled' ? 'Request Cancelled' : status === 'interrupted' ? 'Request Interrupted' : 'Request Failed';

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-(--vscode-panel-border) pb-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="font-mono text-xs uppercase px-2 py-1 rounded-sm bg-(--vscode-badge-background) text-(--vscode-badge-foreground)">
            {error.request.method}
          </span>
          <span className="font-mono text-xs break-all text-(--vscode-foreground)">{error.request.url}</span>
        </div>
      </div>

      <div
        role="status"
        className="rounded-sm border border-(--vscode-panel-border) p-3 text-xs text-(--vscode-foreground)"
      >
        <div className="flex items-center gap-2 font-semibold">
          <Icon
            name={status === 'cancelled' ? 'circle-slash' : status === 'interrupted' ? 'debug-pause' : 'error'}
            size="sm"
            className={
              status === 'failed' ? 'text-(--vscode-errorForeground)' : 'text-(--vscode-descriptionForeground)'
            }
          />
          <span>{title}</span>
        </div>
        <div className="mt-2 font-mono select-text break-words">{error.message}</div>
      </div>
    </div>
  );
}
