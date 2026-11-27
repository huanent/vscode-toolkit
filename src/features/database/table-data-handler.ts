import * as vscode from 'vscode';
import { showOperationError } from '@/host/utils/show-operation-error';
import {
  isDatabaseCopyCellRequest,
  isDatabaseRowMutationRequest,
  isDatabaseTableFilterRequest,
  type DatabaseCopyCellResult,
  type DatabaseRowMutation,
  type DatabaseRowMutationResult,
  type DatabaseTable,
  type DatabaseTableFilters,
  type DatabaseTableFilterRequest,
  type DatabaseTableCounts,
} from '@/features/database/protocol';

export function registerTableDataHandler(
  panel: vscode.WebviewPanel,
  read: (filters?: DatabaseTableFilters, counts?: DatabaseTableCounts) => Promise<DatabaseTable>,
  mutate: (mutation: DatabaseRowMutation) => Promise<void>,
): vscode.Disposable {
  let mutating = false;
  let filtering = false;
  let disposed = false;
  let pendingFilter: DatabaseTableFilterRequest | undefined;
  let countCache: { key: string; counts: DatabaseTableCounts; expiresAt: number } | undefined;
  const listener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (isDatabaseCopyCellRequest(message)) {
      try {
        await vscode.env.clipboard.writeText(message.text);
        await panel.webview.postMessage({
          type: 'cellCopied',
          requestId: message.requestId,
        } satisfies DatabaseCopyCellResult);
      } catch (error) {
        showOperationError(error);
      }
    } else if (isDatabaseTableFilterRequest(message)) {
      pendingFilter = message;
      if (filtering) return;
      filtering = true;
      try {
        while (pendingFilter && !disposed) {
          const request = pendingFilter;
          pendingFilter = undefined;
          try {
            const key = JSON.stringify({
              search: request.filters.search ?? '',
              columns: request.filters.columns ?? {},
              revision: request.filters.revision ?? 0,
            });
            const cached = countCache?.key === key && countCache.expiresAt > Date.now() ? countCache : undefined;
            const data = await read(request.filters, cached?.counts);
            if (!cached) {
              countCache = {
                key,
                counts: { rowCount: data.rowCount, filteredRowCount: data.filteredRowCount },
                expiresAt: Date.now() + 30000,
              };
            }
            if (!disposed && !pendingFilter) {
              await panel.webview.postMessage({ type: 'tableFilterResult', requestId: request.requestId, data });
            }
          } catch (error) {
            if (!disposed && !pendingFilter) {
              showOperationError(error);
              await panel.webview.postMessage({ type: 'tableFilterResult', requestId: request.requestId });
            }
          }
        }
      } finally {
        filtering = false;
      }
    } else if (isDatabaseRowMutationRequest(message)) {
      const result: DatabaseRowMutationResult = { type: 'rowMutationResult', requestId: message.requestId };
      if (mutating) {
        showOperationError('Another row operation is in progress.');
        result.failed = true;
        await panel.webview.postMessage(result);
        return;
      }
      mutating = true;
      try {
        if (message.operation === 'delete') {
          const confirmation = await vscode.window.showWarningMessage(
            'Delete this row?',
            { modal: true, detail: 'This permanently deletes the selected row.' },
            'Delete',
          );
          if (confirmation !== 'Delete') result.cancelled = true;
        }
        if (!result.cancelled) {
          countCache = undefined;
          await mutate(message);
        }
      } catch (error) {
        showOperationError(error);
        result.failed = true;
      } finally {
        mutating = false;
      }
      await panel.webview.postMessage(result);
    }
  });
  return new vscode.Disposable(() => {
    disposed = true;
    pendingFilter = undefined;
    listener.dispose();
  });
}
