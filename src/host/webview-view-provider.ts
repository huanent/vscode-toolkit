import * as vscode from 'vscode';
import { serveWebviewData } from '@/host/webview-bridge';
import { getWebviewHtml } from '@/host/webview-html';
import type { WebviewPage } from '@/host/webview-pages';

export interface WebviewViewHandler {
  load?: () => Promise<unknown>;
  onResolve?: (webview: vscode.Webview) => void;
  onMessage?: (message: unknown, webview: vscode.Webview) => Promise<void> | void;
  onDispose?: () => void;
}

export class WebviewViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly assetsUri: vscode.Uri,
    private readonly page: WebviewPage,
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
      page: this.page.page,
    });
  }
}
