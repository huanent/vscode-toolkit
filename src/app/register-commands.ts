import * as vscode from 'vscode';
import { generateGitignore } from '@/features/git/gitignore-service';
import { registerScripts } from '@/features/scripts/register-scripts';
import { registerTempCommands } from '@/features/temp/commands';
import { registerPlaybookCommands } from '@/features/playbook/commands';
import { registerCredentialCommands } from '@/features/credential/commands';
import { registerExplorerCommands } from '@/features/explorer/commands';
import { registerChat } from '@/features/chat/editor';
import { createFileClipboard } from '@/host/utils/file-clipboard';

export function registerCommands(
  context: vscode.ExtensionContext,
  refreshTempFiles: () => Promise<void>,
  refreshPlaybookFiles: () => Promise<void>,
  openPlaybookEditor: (id?: string) => Promise<void>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.generateGitignore', () => generateGitignore(context.extensionUri)),
  );
  const clipboard = createFileClipboard(async () => {
    await refreshTempFiles();
    await vscode.commands.executeCommand('toolkit.explorer.refresh');
  });
  registerTempCommands(context, refreshTempFiles, clipboard);
  registerPlaybookCommands(context, refreshPlaybookFiles, openPlaybookEditor);
  registerCredentialCommands(context);
  registerExplorerCommands(context, clipboard);
  registerChat(context);
  registerScripts(context);
}
