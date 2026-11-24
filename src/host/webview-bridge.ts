import type * as vscode from 'vscode';
import type { WebviewHostMessage, WebviewReadyMessage } from '@/shared/webview-protocol';
import { showOperationError } from '@/host/utils/show-operation-error';

export interface WebviewDataOptions {
  once?: boolean;
}

/**
 * Serves data to a webview using the shared `ready` → `loaded` / `loadFailed` protocol,
 * so pages only render the payload instead of re-implementing the handshake.
 * Loads once by default; views can reload data when their webview context is recreated.
 */
export function serveWebviewData<TData>(
  webview: vscode.Webview,
  load: () => Promise<TData>,
  options: WebviewDataOptions = {},
): vscode.Disposable {
  const once = options.once ?? true;
  let disposed = false;
  let loading = false;
  let served = false;

  async function postMessage(message: WebviewHostMessage<TData>): Promise<boolean> {
    if (disposed) return false;
    try {
      return await webview.postMessage(message);
    } catch {
      return false;
    }
  }

  const listener = webview.onDidReceiveMessage(async (message: WebviewReadyMessage | undefined) => {
    if (disposed || loading || (once && served) || message?.type !== 'ready') return;
    loading = true;
    try {
      const data = await load();
      const delivered = await postMessage({ type: 'loaded', data });
      if (once && delivered) served = true;
    } catch (error) {
      if (!disposed) {
        showOperationError(error);
        await postMessage({ type: 'loadFailed' });
      }
    } finally {
      loading = false;
    }
  });

  return {
    dispose() {
      disposed = true;
      listener.dispose();
    },
  };
}
