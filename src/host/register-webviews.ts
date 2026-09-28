import * as vscode from 'vscode';
import { createTempFilesHandler } from '@/features/temp/view-handler';
import { webviewPages } from '@/host/webview-pages';
import { WebviewViewProvider } from '@/host/webview-view-provider';

export function registerWebviews(context: vscode.ExtensionContext): void {
  const assetsUri = vscode.Uri.file(__dirname);

  for (const page of webviewPages) {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        page.id,
        new WebviewViewProvider(
          assetsUri,
          page,
          page.id === 'toolkit.dashboard' ? createTempFilesHandler(context) : undefined,
        ),
      ),
    );
  }
}
