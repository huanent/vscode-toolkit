import * as vscode from 'vscode';
import { generateGitignore } from '@/features/git/gitignore-service';
import { registerScripts } from '@/features/scripts/register-scripts';
import { registerTempCommands } from '@/features/temp/commands';
import { registerPlaybookCommands } from '@/features/playbook/commands';
import { registerCredentialCommands } from '@/features/credential/commands';
import { registerExplorerCommands } from '@/features/explorer/commands';
import { registerChat } from '@/features/chat/editor';

export function registerCommands(
  context: vscode.ExtensionContext,
  refreshTempFiles: () => Promise<void>,
  refreshPlaybookFiles: () => Promise<void>,
  openPlaybookEditor: (id?: string) => Promise<void>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.generateGitignore', () => generateGitignore(context.extensionUri)),
  );
  registerTempCommands(context, refreshTempFiles);
  registerPlaybookCommands(context, refreshPlaybookFiles, openPlaybookEditor);
  registerCredentialCommands(context);
  registerExplorerCommands(context);
  registerChat(context);
  registerScripts(context);
}
