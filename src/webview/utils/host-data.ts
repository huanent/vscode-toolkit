import { useEffect, useEffectEvent, useState } from 'react';
import type { WebviewHostMessage, WebviewReadyMessage } from '@/shared/webview-protocol';

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
  | { status: 'loaded'; data: TData; error?: string }
  | { status: 'error'; message: string };

/**
 * Requests the host payload using the shared `ready` → `loaded` / `error` protocol.
 * Pages stay declarative: they render `status` instead of wiring message listeners.
 */
export function useHostData<TData, TMessage = never>(
  update?: (message: TMessage, state: HostDataState<TData>) => HostDataState<TData> | undefined,
): HostDataState<TData> {
  const [state, setState] = useState<HostDataState<TData>>({ status: 'loading' });

  const onMessage = useEffectEvent((event: MessageEvent<WebviewHostMessage<TData> | TMessage>) => {
    const message = event.data;
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    if (message.type === 'loaded' && 'data' in message) {
      setState({ status: 'loaded', data: message.data as TData });
    } else if (message.type === 'error' && 'message' in message && typeof message.message === 'string') {
      const error = message.message;
      setState((previous) =>
        previous.status === 'loaded' ? { ...previous, error } : { status: 'error', message: error },
      );
    } else if (update) {
      setState((previous) => update(message as TMessage, previous) ?? previous);
    }
  });

  useEffect(() => {
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
