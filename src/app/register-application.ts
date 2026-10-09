import * as vscode from 'vscode';
import { registerCommands } from '@/app/register-commands';
import { registerWebviews } from '@/app/register-webviews';
import { createPerfTipsTracker } from '@/features/perftips/perftips';
import { registerSourceControl } from '@/features/git/source-control';
import { registerXmlFormatter } from '@/features/xml/register-xml-formatter';
import { registerArchiveEditor } from '@/features/archive/editor';
import { registerSpreadsheetEditor } from '@/features/spreadsheet/editor';
import { registerSqliteEditor } from '@/features/database/sqlite/editor';
import { registerHttpLanguage } from '@/features/http/register-http';
import { HttpResultService } from '@/features/http/result-service';
import { ResultTaskService } from '@/features/result/task-service';
import { createTempFilesView } from '@/features/temp/view-handler';
import { createWorkflowFilesView } from '@/features/workflow/view-handler';
import { resolveStorageDirectory } from '@/host/utils/storage';

export async function registerApplication(context: vscode.ExtensionContext): Promise<void> {
  const tasks = new ResultTaskService();
  context.subscriptions.push(tasks);
  try {
    await tasks.initialize(resolveStorageDirectory(context, 'result2'));
  } catch (error) {
    tasks.dispose();
    void vscode.window.showErrorMessage(
      `Failed to initialize ResultTaskService: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const httpResults = new HttpResultService(tasks);
  const tempFiles = createTempFilesView(context);
  const workflowFiles = createWorkflowFilesView(context);
  context.subscriptions.push(tempFiles);
  context.subscriptions.push(workflowFiles);
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.result.focus', () =>
      vscode.commands.executeCommand('workbench.view.extension.toolkit_result'),
    ),
  );
  registerCommands(context, tempFiles.refresh, workflowFiles.refresh);
  context.subscriptions.push(registerXmlFormatter());
  context.subscriptions.push(registerHttpLanguage(httpResults));
  context.subscriptions.push(registerArchiveEditor(context));
  context.subscriptions.push(registerSpreadsheetEditor(context));
  context.subscriptions.push(registerSqliteEditor(context, tasks));
  registerSourceControl(context);
  context.subscriptions.push(
    vscode.debug.registerDebugAdapterTrackerFactory('*', {
      createDebugAdapterTracker(session) {
        return createPerfTipsTracker(session);
      },
    }),
  );
  registerWebviews(context, tasks, tempFiles, workflowFiles);
}
