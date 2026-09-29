import * as vscode from 'vscode';
import { createTempFilesHandler } from '@/features/temp/view-handler';
import { createResultViewHandler } from '@/features/http/view-handler';
import { webviewPages } from '@/host/webview-pages';
import { WebviewViewProvider } from '@/host/webview-view-provider';

export function registerWebviews(context: vscode.ExtensionContext): void {
  const assetsUri = vscode.Uri.file(__dirname);

  for (const page of webviewPages) {
    let handler;
    if (page.id === 'toolkit.dashboard') {
      handler = createTempFilesHandler(context);
    } else if (page.id === 'toolkit.result') {
      handler = createResultViewHandler(context);
    }

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(page.id, new WebviewViewProvider(assetsUri, page, handler)),
    );
  }
}
