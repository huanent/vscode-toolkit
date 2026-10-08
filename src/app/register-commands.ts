import * as vscode from 'vscode';
import { generateGitignore } from '@/features/git/gitignore-service';
import { registerScripts } from '@/features/scripts/register-scripts';
import { registerTempCommands } from '@/features/temp/commands';

export function registerCommands(context: vscode.ExtensionContext, refreshTempFiles: () => Promise<void>): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.helloWorld', () => {
      void vscode.window.showInformationMessage('Hello World from toolkit!');
    }),
    vscode.commands.registerCommand('toolkit.generateGitignore', () => generateGitignore(context.extensionUri)),
  );
  registerTempCommands(context, refreshTempFiles);
  registerScripts(context);
}
