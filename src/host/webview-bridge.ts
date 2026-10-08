import type * as vscode from 'vscode';
import type { WebviewErrorMessage, WebviewLoadedMessage, WebviewReadyMessage } from '@/shared/webview-protocol';

export interface WebviewDataOptions {
  once?: boolean;
}

/**
 * Serves data to a webview using the shared `ready` → `loaded` / `error` protocol,
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

  async function postMessage(message: WebviewLoadedMessage<TData> | WebviewErrorMessage): Promise<boolean> {
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
        await postMessage({
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        } satisfies WebviewErrorMessage);
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
