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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-(--vscode-panel-border) pb-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <span className="font-mono text-xs uppercase px-1 py-0.5 rounded bg-(--vscode-badge-background) text-(--vscode-badge-foreground)">
            {error.request.method}
          </span>
          <span className="font-mono text-xs break-all text-(--vscode-foreground)">{error.request.url}</span>
        </div>
      </div>

      <div className="rounded border border-(--vscode-inputValidation-errorBorder) bg-(--vscode-inputValidation-errorBackground) p-3 text-xs text-(--vscode-errorForeground)">
        <div className="flex items-center gap-2 font-semibold">
          <Icon name="error" size="sm" />
          <span>{title}</span>
        </div>
        <div className="mt-2 font-mono break-all">{error.message}</div>
      </div>
    </div>
  );
}
