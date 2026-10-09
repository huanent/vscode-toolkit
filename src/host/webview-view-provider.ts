import * as vscode from 'vscode';
import { serveWebviewData } from '@/host/webview-bridge';
import { getWebviewHtml } from '@/host/webview-html';

export interface WebviewViewHandler {
  load?: () => Promise<unknown>;
  onResolve?: (webview: vscode.Webview) => void;
  onMessage?: (message: unknown, webview: vscode.Webview) => Promise<void> | void;
  onDispose?: () => void;
}

export function composeWebviewHandlers(handlers: Record<string, WebviewViewHandler>): WebviewViewHandler {
  return {
    load: async () => {
      const result: Record<string, unknown> = {};
      for (const [key, handler] of Object.entries(handlers)) {
        if (handler.load) {
          result[key] = await handler.load();
        }
      }
      return result;
    },
    onResolve: (webview) => Object.values(handlers).forEach((h) => h.onResolve?.(webview)),
    onMessage: async (message, webview) => {
      for (const h of Object.values(handlers)) {
        await h.onMessage?.(message, webview);
      }
    },
    onDispose: () => Object.values(handlers).forEach((h) => h.onDispose?.()),
  };
}

export class WebviewViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly assetsUri: vscode.Uri,
    private readonly page: string,
    private readonly handler?: WebviewViewHandler,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.assetsUri],
    };
    const disposables: vscode.Disposable[] = [];
    this.handler?.onResolve?.(webviewView.webview);
    if (this.handler?.load) {
      disposables.push(serveWebviewData(webviewView.webview, this.handler.load, { once: false }));
    }
    if (this.handler?.onMessage) {
      const onMessage = this.handler.onMessage;
      disposables.push(
        webviewView.webview.onDidReceiveMessage((message: unknown) => {
          void Promise.resolve()
            .then(() => onMessage(message, webviewView.webview))
            .catch((error: unknown) => {
              void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
            });
        }),
      );
    }
    webviewView.onDidDispose(() => {
      disposables.forEach((disposable) => disposable.dispose());
      this.handler?.onDispose?.();
    });
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.assetsUri, {
      page: this.page,
    });
  }
}
