import * as vscode from 'vscode';
import type { TempFilesView } from '@/features/temp/view-handler';
import { createResultViewHandler } from '@/features/result/view-handler';
import type { ResultTaskService } from '@/features/result/task-service';
import { WebviewViewProvider, type WebviewViewHandler } from '@/host/webview-view-provider';

interface WebviewRegistration {
  id: string;
  page: string;
  handler: WebviewViewHandler;
}

export function registerWebviews(
  context: vscode.ExtensionContext,
  tasks: ResultTaskService,
  tempFiles: TempFilesView,
): void {
  const assetsUri = vscode.Uri.file(__dirname);
  const views: WebviewRegistration[] = [
    { id: 'toolkit.dashboard', page: 'dashboard', handler: tempFiles.handler },
    { id: 'toolkit.result', page: 'result', handler: createResultViewHandler(tasks) },
  ];

  for (const view of views) {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(view.id, new WebviewViewProvider(assetsUri, view.page, view.handler)),
    );
  }
}
