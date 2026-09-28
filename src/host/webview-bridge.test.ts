import type * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import { serveWebviewData } from './webview-bridge';

describe('serveWebviewData', () => {
  it('reloads data for repeated ready messages when once is disabled', async () => {
    const listeners: Array<(message: { type?: string } | undefined) => Promise<void>> = [];
    const postMessage = vi.fn<() => Promise<boolean>>(async () => true);
    const webview = {
      onDidReceiveMessage: (listener: (message: { type?: string } | undefined) => Promise<void>) => {
        listeners.push(listener);
        return { dispose: vi.fn<() => void>() };
      },
      postMessage,
    } as unknown as vscode.Webview;
    const load = vi.fn<() => Promise<string[]>>().mockResolvedValueOnce(['first']).mockResolvedValueOnce(['second']);
    const bridge = serveWebviewData(webview, load, { once: false });

    await listeners[0]({ type: 'ready' });
    await listeners[0]({ type: 'ready' });

    expect(load).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenNthCalledWith(1, { type: 'loaded', data: ['first'] });
    expect(postMessage).toHaveBeenNthCalledWith(2, { type: 'loaded', data: ['second'] });
    bridge.dispose();
  });
});
