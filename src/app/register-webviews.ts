import * as vscode from 'vscode';
import type { TempFilesView } from '@/features/temp/view-handler';
import type { WorkflowFilesView } from '@/features/workflow/view-handler';
import { createAssetsView } from '@/features/assets/view-handler';
import { AssetService } from '@/features/assets/service';
import { MysqlService } from '@/features/database/mysql-service';
import { registerMysqlEditor } from '@/features/database/mysql/editor';
import { SshService } from '@/features/ssh/ssh-service';
import { registerSshTools } from '@/features/ssh/tools';
import { registerDatabaseTools } from '@/features/database/tools';
import { registerAssetTools } from '@/features/assets/tools';
import { createWorkflowEditorUri, registerWorkflowEditor, workflowEditorViewType } from '@/features/workflow/editor';
import { WorkflowResultService } from '@/features/workflow/result-service';
import { registerWorkflowTools } from '@/features/workflow/tools';
import { createResultViewHandler } from '@/features/result/view-handler';
import type { ResultTaskService } from '@/features/result/task-service';
import { WebviewViewProvider, type WebviewViewHandler, composeWebviewHandlers } from '@/host/webview-view-provider';
import { CredentialService } from '@/features/credential/service';
import { resolveStorageRoots } from '@/host/utils/storage';
import type { CollapseDashboardTreeMessage } from '@/shared/dashboard-protocol';

interface WebviewRegistration {
  id: string;
  page: string;
  handler: WebviewViewHandler;
}

export function registerWebviews(
  context: vscode.ExtensionContext,
  tasks: ResultTaskService,
  tempFiles: TempFilesView,
  workflowFiles: WorkflowFilesView,
): void {
  const assetsUri = vscode.Uri.file(__dirname);
  const assets = new AssetService(context);
  const credentials = new CredentialService(context);
  const mysql = new MysqlService(assets, tasks, credentials);
  const ssh = new SshService(assets, credentials, context.globalState);
  const workflowResults = new WorkflowResultService(tasks, ssh);
  context.subscriptions.push(
    registerAssetTools(assets),
    registerDatabaseTools(mysql),
    ...registerSshTools(ssh),
    ...registerWorkflowTools(context, ssh, workflowResults, workflowFiles.refresh),
  );
  workflowFiles.setEditorOpener(async (id, name, parentId) => {
    await vscode.commands.executeCommand(
      'vscode.openWith',
      createWorkflowEditorUri(id, name, parentId),
      workflowEditorViewType,
    );
  });
  workflowFiles.setRunner((name, workflow) => workflowResults.runWorkflow(name, workflow));
  context.subscriptions.push(
    mysql,
    ssh,
    registerMysqlEditor(context, mysql, tasks),
    registerWorkflowEditor(
      context,
      () => resolveStorageRoots(context, 'workflows'),
      ssh,
      workflowResults,
      workflowFiles.refresh,
    ),
  );
  const assetsView = createAssetsView(context, assets, [mysql, ssh], credentials);
  const composedDashboardHandler = composeWebviewHandlers({
    temp: tempFiles.handler,
    workflow: workflowFiles.handler,
    assets: assetsView,
  });
  let dashboardWebview: vscode.Webview | undefined;
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.dashboard.refresh', async () => {
      try {
        await Promise.all([assetsView.refresh(), workflowFiles.refresh(), tempFiles.refresh()]);
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
    vscode.commands.registerCommand('toolkit.dashboard.collapseAll', () => {
      void dashboardWebview?.postMessage({ type: 'collapseActiveTree' } satisfies CollapseDashboardTreeMessage);
    }),
  );
  const dashboardHandler: WebviewViewHandler = {
    ...composedDashboardHandler,
    onResolve: (webview) => {
      dashboardWebview = webview;
      composedDashboardHandler.onResolve?.(webview);
    },
    onDispose: () => {
      dashboardWebview = undefined;
      composedDashboardHandler.onDispose?.();
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
