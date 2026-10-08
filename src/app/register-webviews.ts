import * as vscode from 'vscode';
import type { TempFilesView } from '@/features/temp/view-handler';
import { createAssetsView } from '@/features/assets/view-handler';
import { AssetService } from '@/features/assets/service';
import { MysqlService } from '@/features/database/mysql-service';
import { SshService } from '@/features/ssh/ssh-service';
import type { DashboardData, AssetViewEntry } from '@/features/assets/protocol';
import type { TempTreeEntry } from '@/features/temp/protocol';
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
  const assets = new AssetService(context);
  const mysql = new MysqlService(assets, tasks);
  const ssh = new SshService(assets);
  context.subscriptions.push(mysql, ssh);
  const assetsView = createAssetsView(context, assets, [mysql, ssh]);
  const dashboardHandler: WebviewViewHandler = {
    load: async () =>
      ({
        temp: (await tempFiles.handler.load?.()) as TempTreeEntry[],
        assets: (await assetsView.load?.()) as AssetViewEntry[],
      }) satisfies DashboardData,
    onResolve: (webview) => {
      tempFiles.handler.onResolve?.(webview);
      assetsView.onResolve?.(webview);
    },
    onDispose: () => {
      tempFiles.handler.onDispose?.();
      assetsView.onDispose?.();
    },
    onMessage: async (message, webview) => {
      await tempFiles.handler.onMessage?.(message, webview);
      await assetsView.onMessage?.(message, webview);
    },
  };
  const views: WebviewRegistration[] = [
    { id: 'toolkit.dashboard', page: 'dashboard', handler: dashboardHandler },
    { id: 'toolkit.result', page: 'result', handler: createResultViewHandler(tasks) },
  ];

  for (const view of views) {
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(view.id, new WebviewViewProvider(assetsUri, view.page, view.handler)),
    );
  }
}
