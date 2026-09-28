import type * as vscode from 'vscode';

export interface WebviewReadyMessage {
  type: 'ready';
}

export interface WebviewLoadedMessage<TData> {
  type: 'loaded';
  data: TData;
}

export interface WebviewErrorMessage {
  type: 'error';
  message: string;
}

export type WebviewHostMessage<TData> = WebviewLoadedMessage<TData> | WebviewErrorMessage;

/**
 * Serves data to a webview using the shared `ready` → `loaded` / `error` protocol,
 * so pages only render the payload instead of re-implementing the handshake.
 * The load runs at most once per webview session; a failed load can be retried.
 */
export function serveWebviewData<TData>(webview: vscode.Webview, load: () => Promise<TData>): vscode.Disposable {
  let disposed = false;
  let loading = false;
  let served = false;

  const listener = webview.onDidReceiveMessage(async (message: WebviewReadyMessage | undefined) => {
    if (disposed || loading || served || message?.type !== 'ready') return;
    loading = true;
    try {
      const data = await load();
      served = true;
      if (!disposed) await webview.postMessage({ type: 'loaded', data } satisfies WebviewLoadedMessage<TData>);
    } catch (error) {
      if (!disposed) {
        await webview.postMessage({
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
