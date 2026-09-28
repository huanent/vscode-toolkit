import * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import { registerWebviewEditor } from './webview-editor';

vi.mock('vscode', () => ({
  window: {
    registerCustomEditorProvider: vi.fn<(...args: unknown[]) => { dispose: () => void }>(() => ({
      dispose: vi.fn<() => void>(),
    })),
  },
  Uri: { joinPath: vi.fn<(...args: unknown[]) => vscode.Uri>(() => ({ fsPath: '/extension/dist' }) as vscode.Uri) },
  ThemeIcon: class {
    constructor(readonly id: string) {}
  },
}));
vi.mock('./webview-html', () => ({
  getWebviewHtml: vi.fn<(webview: vscode.Webview, assetsUri: vscode.Uri) => string>(() => '<html></html>'),
}));

const context = { extensionUri: { fsPath: '/extension' } } as vscode.ExtensionContext;
const uri = { scheme: 'file', path: '/sample.zip', fsPath: '/sample.zip' } as vscode.Uri;

function createPanel() {
  const disposeListener = vi.fn<() => void>();
  let messageListener: ((message: { type?: string }) => Promise<void>) | undefined;
  const receiveMessage = vi.fn<(listener: (message: { type?: string }) => Promise<void>) => { dispose: () => void }>(
    (listener) => {
      messageListener = listener;
      return { dispose: disposeListener };
    },
  );
  const disposeListeners: Array<() => void> = [];
  const onDidDispose = vi.fn<(listener: () => void) => { dispose: () => void }>((listener) => {
    disposeListeners.push(listener);
    return { dispose: vi.fn<() => void>() };
  });
  const postMessage = vi.fn<(message: unknown) => Promise<boolean>>(async () => true);
  const webview = { onDidReceiveMessage: receiveMessage, postMessage };
  const panel = { webview, onDidDispose } as unknown as vscode.WebviewPanel;

  return {
    panel,
    webview,
    postMessage,
    disposeListener,
    disposePanel: () => disposeListeners.forEach((listener) => listener()),
    ready: () => messageListener!({ type: 'ready' }),
  };
}

function provider() {
  return vi
    .mocked(vscode.window.registerCustomEditorProvider)
    .mock.calls.at(-1)![1] as vscode.CustomReadonlyEditorProvider;
}

describe('registerWebviewEditor', () => {
  it('validates the document and serves loaded data through the shared protocol', async () => {
    const validate = vi.fn<(uri: vscode.Uri) => void>();
    const load = vi.fn<(uri: vscode.Uri) => Promise<string[]>>(async () => ['entry']);
    registerWebviewEditor(context, { viewType: 'toolkit.test', page: 'archive', icon: 'file-zip', validate, load });
    const { panel, postMessage, ready } = createPanel();

    const document = await provider().openCustomDocument(
      uri,
      {} as vscode.CustomDocumentOpenContext,
      {} as vscode.CancellationToken,
    );
    await provider().resolveCustomEditor(document, panel, {} as vscode.CancellationToken);
    await ready();

    expect(validate).toHaveBeenCalledWith(uri);
    expect(load).toHaveBeenCalledWith(uri);
    expect(postMessage).toHaveBeenCalledWith({ type: 'loaded', data: ['entry'] });
  });

  it('reports load failures as error messages', async () => {
    registerWebviewEditor(context, {
      viewType: 'toolkit.test',
      page: 'archive',
      load: async () => {
        throw new Error('boom');
      },
    });
    const { panel, postMessage, ready } = createPanel();

    const document = await provider().openCustomDocument(
      uri,
      {} as vscode.CustomDocumentOpenContext,
      {} as vscode.CancellationToken,
    );
    await provider().resolveCustomEditor(document, panel, {} as vscode.CancellationToken);
    await ready();

    expect(postMessage).toHaveBeenCalledWith({ type: 'error', message: 'boom' });
  });

  it('serves at most once and disposes its listener with the panel', async () => {
    const load = vi.fn<(uri: vscode.Uri) => Promise<string[]>>(async () => []);
    registerWebviewEditor(context, { viewType: 'toolkit.test', page: 'archive', load });
    const { panel, disposeListener, disposePanel, ready } = createPanel();

    const document = await provider().openCustomDocument(
      uri,
      {} as vscode.CustomDocumentOpenContext,
      {} as vscode.CancellationToken,
    );
    await provider().resolveCustomEditor(document, panel, {} as vscode.CancellationToken);
    await ready();
    await ready();
    expect(load).toHaveBeenCalledOnce();

    disposePanel();
    expect(disposeListener).toHaveBeenCalledOnce();
  });
});
