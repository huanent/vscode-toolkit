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

  const listener = webview.onDidReceiveMessage(async (message: WebviewReadyMessage | undefined) => {
    if (disposed || loading || (once && served) || message?.type !== 'ready') return;
    loading = true;
    try {
      const data = await load();
      if (once) served = true;
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
