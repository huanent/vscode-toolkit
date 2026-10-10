import * as vscode from 'vscode';
import { generateGitignore } from '@/features/git/gitignore-service';
import { registerScripts } from '@/features/scripts/register-scripts';
import { registerTempCommands } from '@/features/temp/commands';
import { registerWorkflowCommands } from '@/features/workflow/commands';
import { registerCredentialCommands } from '@/features/credential/commands';

export function registerCommands(
  context: vscode.ExtensionContext,
  refreshTempFiles: () => Promise<void>,
  refreshWorkflowFiles: () => Promise<void>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.generateGitignore', () => generateGitignore(context.extensionUri)),
  );
  registerTempCommands(context, refreshTempFiles);
  registerWorkflowCommands(context, refreshWorkflowFiles);
  registerCredentialCommands(context);
  registerScripts(context);
}
