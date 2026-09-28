import * as vscode from 'vscode';
import { generateGitignore } from '@/features/git/gitignore-service';

export function registerCommands(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('toolkit.helloWorld', () => {
			void vscode.window.showInformationMessage('Hello World from toolkit!');
		}),
		vscode.commands.registerCommand('toolkit.generateGitignore', () => generateGitignore(context.extensionUri)),
	);
}
