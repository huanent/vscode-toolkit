import * as vscode from 'vscode';
import { generateGitignore } from '@/features/git/gitignore-service';
import { createTempFileFromInput } from '@/features/temp/view-handler';

export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.helloWorld', () => {
      void vscode.window.showInformationMessage('Hello World from toolkit!');
    }),
    vscode.commands.registerCommand('toolkit.generateGitignore', () => generateGitignore(context.extensionUri)),
    vscode.commands.registerCommand('toolkit.createTempFile', () =>
      createTempFileFromInput(context).catch((error: unknown) => {
        void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }),
    ),
  );
}
