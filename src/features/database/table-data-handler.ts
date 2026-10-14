import * as vscode from 'vscode';
import {
  isDatabaseRowMutationRequest,
  isDatabaseTableFilterRequest,
  type DatabaseRowMutation,
  type DatabaseRowMutationResult,
  type DatabaseTable,
  type DatabaseTableFilters,
} from '@/features/database/protocol';

export function registerTableDataHandler(
  panel: vscode.WebviewPanel,
  read: (filters?: DatabaseTableFilters) => Promise<DatabaseTable>,
  mutate: (mutation: DatabaseRowMutation) => Promise<void>,
): vscode.Disposable {
  let mutating = false;
  return panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (isDatabaseTableFilterRequest(message)) {
      try {
        await panel.webview.postMessage({
          type: 'tableFilterResult',
          requestId: message.requestId,
          data: await read(message.filters),
        });
      } catch (error) {
        await panel.webview.postMessage({
          type: 'tableFilterResult',
          requestId: message.requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (isDatabaseRowMutationRequest(message)) {
      const result: DatabaseRowMutationResult = { type: 'rowMutationResult', requestId: message.requestId };
      if (mutating) {
        result.error = 'Another row operation is in progress.';
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
        if (!result.cancelled) await mutate(message);
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
      } finally {
        mutating = false;
      }
      await panel.webview.postMessage(result);
    }
  });
}
