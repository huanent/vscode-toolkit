import * as vscode from 'vscode';
import { registerStatusBar } from '@/features/custom/status-bar';
import { registerCustomCommands } from '@/features/custom/command';
import { registerCommands } from '@/app/register-commands';
import { registerWebviews } from '@/app/register-webviews';
import { createPerfTipsTracker } from '@/features/perftips/perftips';
import { registerSourceControl } from '@/features/git/source-control';
import { registerXmlFormatter } from '@/features/xml/register-xml-formatter';
import { registerArchiveEditor } from '@/features/archive/editor';
import { registerSpreadsheetEditor } from '@/features/spreadsheet/editor';
import { registerSqliteEditor } from '@/features/database/sqlite/editor';
import { disposeSqliteProcesses } from '@/features/database/sqlite/process-client';
import { registerHttpLanguage } from '@/features/http/register-http';
import { HttpResultService } from '@/features/http/result-service';
import { CredentialService } from '@/features/credential/service';
import { ResultTaskService } from '@/features/result/task-service';
import { createTempFilesView } from '@/features/temp/view-handler';
import { createPlaybookFilesView } from '@/features/playbook/view-handler';
import { resolveStorageDirectory } from '@/host/utils/storage';

export async function registerApplication(context: vscode.ExtensionContext): Promise<void> {
  registerStatusBar(context);
  await registerCustomCommands(context);
  context.subscriptions.push({ dispose: disposeSqliteProcesses });
  const tasks = new ResultTaskService();
  context.subscriptions.push(tasks);
  void tasks.initialize(resolveStorageDirectory(context, 'results')).catch((error: unknown) => {
    tasks.dispose();
    void vscode.window.showErrorMessage(
      `Failed to initialize ResultTaskService: ${error instanceof Error ? error.message : String(error)}`,
      { modal: true },
    );
  });
  const credentials = new CredentialService(context);
  const httpResults = new HttpResultService(tasks, credentials);
  const tempFiles = createTempFilesView(context);
  const playbookFiles = createPlaybookFilesView(context);
  context.subscriptions.push(tempFiles);
  context.subscriptions.push(playbookFiles);
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.results.focus', () =>
      vscode.commands.executeCommand('workbench.view.extension.toolkit_results'),
    ),
  );
  registerCommands(context, tempFiles.refresh, playbookFiles.refresh, playbookFiles.openEditor);
  context.subscriptions.push(registerXmlFormatter());
  context.subscriptions.push(registerHttpLanguage(httpResults, credentials));
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
  registerWebviews(context, tasks, tempFiles, playbookFiles);
}
