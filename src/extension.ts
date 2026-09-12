import * as vscode from 'vscode';
import { registerDashboard } from './features/dashboard/panel';
import { registerSourceControl } from './features/git/sourceControl';
import { generateGitignore } from './features/git/gitignoreService';
import { registerHttpClient } from './features/http/httpClient';
import { registerChat } from './features/chat/registerChat';
import { registerExplorer } from './features/explorer/registerExplorer';
import { createPerfTipsTracker } from './features/perftips/perftips';
import { registerPackageScriptWatcher, runPackageScript } from './features/scripts/packageScripts';
import { runScript } from './features/scripts/runScript';
import { registerScriptRuntimeWatcher } from './features/scripts/scriptRuntime';
import { registerXmlFormatter } from './features/xml/xmlFormatter';
import { registerSsh } from './features/ssh/registerSsh';
import { registerDatabase } from './features/database/registerDatabase';
import { registerContainer } from './features/container/registerContainer';
import { registerWorkflow } from './features/workflow/registerWorkflow';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	registerDashboard(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-toolkit.generateGitignore', () =>
			generateGitignore(context.extensionUri),
		),
		...['runDotnetScript', 'runShScript', 'runBatScript', 'runNodeScript', 'runBunScript'].map(
			command =>
				vscode.commands.registerCommand(`vscode-toolkit.${command}`, (uri, selectedUris) =>
					runScript(context, uri, selectedUris),
				),
		),
		vscode.commands.registerCommand('vscode-toolkit.runNpmScript', runPackageScript),
		vscode.commands.registerCommand('vscode-toolkit.runBunPackageScript', runPackageScript),
		registerXmlFormatter(),
	);
	registerPackageScriptWatcher(context);
	registerScriptRuntimeWatcher(context);
	registerSourceControl(context);
	registerHttpClient(context);
	await registerChat(context);
	await registerExplorer(context);
	await registerSsh(context);
	registerWorkflow(context);
	await registerDatabase(context);
	await registerContainer(context);

	context.subscriptions.push(
		vscode.debug.registerDebugAdapterTrackerFactory('*', {
			createDebugAdapterTracker(session: vscode.DebugSession) {
				return createPerfTipsTracker(session);
			},
		}),
	);
}

export function deactivate(): void {}
