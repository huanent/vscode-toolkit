import * as vscode from 'vscode';
import { registerDashboard } from './dashboard/panel';
import { registerSourceControl } from './git/sourceControl';
import { generateGitignore } from './git/gitignoreService';
import { registerHttpClient } from './http/httpClient';
import { registerChat } from './chat/registerChat';
import { registerExplorer } from './explorer/registerExplorer';
import { createPerfTipsTracker } from './perftips/perftips';
import { registerPackageScriptWatcher, runPackageScript } from './scripts/packageScripts';
import { runScript } from './scripts/runScript';
import { registerScriptRuntimeWatcher } from './scripts/scriptRuntime';
import { registerXmlFormatter } from './xml/xmlFormatter';
import { registerSsh } from './ssh/registerSsh';
import { registerDatabase } from './database/registerDatabase';
import { registerContainer } from './container/registerContainer';
import { registerWorkflow } from './workflow/registerWorkflow';
import { ResultView } from './result/resultView';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const resultView = new ResultView(context.extensionUri);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(ResultView.viewType, resultView, {
		webviewOptions: { retainContextWhenHidden: true },
	}));
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
	registerHttpClient(context, resultView);
	await registerChat(context);
	await registerExplorer(context);
	await registerSsh(context);
	registerWorkflow(context);
	await registerDatabase(context, resultView);
	await registerContainer(context);

	context.subscriptions.push(
		vscode.debug.registerDebugAdapterTrackerFactory('*', {
			createDebugAdapterTracker(session: vscode.DebugSession) {
				return createPerfTipsTracker(session);
			},
		}),
	);
}

export function deactivate(): void { }
