import * as vscode from 'vscode';
import { getWebviewHtml } from '@/host/webview-html';
import type { WebviewPage } from '@/host/webview-pages';

export class WebviewViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly assetsUri: vscode.Uri,
    private readonly page: WebviewPage,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.assetsUri],
    };
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.assetsUri, {
      page: this.page.page,
    });
  }
}
