import * as vscode from 'vscode';
import type { TempFilesView } from '@/features/temp/view-handler';
import type { WorkflowFilesView } from '@/features/workflow/view-handler';
import { createAssetsView } from '@/features/assets/view-handler';
import { AssetService } from '@/features/assets/service';
import { MysqlService } from '@/features/database/mysql-service';
import { registerMysqlEditor } from '@/features/database/mysql/editor';
import { SshService } from '@/features/ssh/ssh-service';
import { createWorkflowEditorUri, registerWorkflowEditor, workflowEditorViewType } from '@/features/workflow/editor';
import { createResultViewHandler } from '@/features/result/view-handler';
import type { ResultTaskService } from '@/features/result/task-service';
import { WebviewViewProvider, type WebviewViewHandler, composeWebviewHandlers } from '@/host/webview-view-provider';
import { CredentialService } from '@/features/credential/service';
import { resolveStorageDirectory } from '@/host/utils/storage';

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
  workflowFiles.setEditorOpener(async (id, name, parentId) => {
    await vscode.commands.executeCommand(
      'vscode.openWith',
      createWorkflowEditorUri(id, name, parentId),
      workflowEditorViewType,
    );
  });
  context.subscriptions.push(
    mysql,
    ssh,
    registerMysqlEditor(context, mysql, tasks),
    registerWorkflowEditor(context, () => resolveStorageDirectory(context, 'workflows'), ssh, workflowFiles.refresh),
  );
  const assetsView = createAssetsView(context, assets, [mysql, ssh], credentials);
  const dashboardHandler = composeWebviewHandlers({
    temp: tempFiles.handler,
    workflow: workflowFiles.handler,
    assets: assetsView,
  });
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
