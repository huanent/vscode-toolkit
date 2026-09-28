import { useEffect, useState } from 'react';
import type { WebviewHostMessage, WebviewReadyMessage } from '@/host/webview-bridge';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

export type HostDataState<TData> =
  | { status: 'loading' }
  | { status: 'loaded'; data: TData }
  | { status: 'error'; message: string };

/**
 * Requests the host payload using the shared `ready` → `loaded` / `error` protocol.
 * Pages stay declarative: they render `status` instead of wiring message listeners.
 */
export function useHostData<TData>(): HostDataState<TData> {
  const [state, setState] = useState<HostDataState<TData>>({ status: 'loading' });

  useEffect(() => {
    const onMessage = (event: MessageEvent<WebviewHostMessage<TData>>) => {
      const message = event.data;
      if (message?.type === 'loaded') {
        setState({ status: 'loaded', data: message.data });
      } else if (message?.type === 'error') {
        setState({ status: 'error', message: message.message });
      }
    };

    window.addEventListener('message', onMessage);
    postToHost({ type: 'ready' } satisfies WebviewReadyMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return state;
}

/** Reads a `data-*` value the host exposed on the root element. */
export function getRootData(name: string): string | undefined {
  return document.getElementById('root')?.dataset[name];
}

let api: VsCodeApi | undefined;

/** Sends a message to the extension host, reusing the single VS Code API instance. */
export function postToHost(message: unknown): void {
  if (!api) {
    const acquire = window.acquireVsCodeApi;
    if (!acquire) throw new Error('acquireVsCodeApi is unavailable outside a VS Code webview.');
    api = acquire();
  }
  api.postMessage(message);
}
