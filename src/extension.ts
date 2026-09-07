import * as vscode from 'vscode';
import { FeatureTreeProvider } from './features/featureTreeProvider';
import { registerSourceControl } from './features/git/sourceControl';
import { generateGitignore } from './features/git/gitignoreService';
import { registerHttpClient } from './features/http/httpClient';
import { LaunchdPanel } from './features/launchd/launchdPanel';
import { registerChat } from './features/chat/registerChat';
import { registerExplorer } from './features/explorer/registerExplorer';
import { PerfTipsProvider } from './features/perftips/perftips';
import { registerNpmScriptWatcher, runNpmScript } from './features/scripts/npmScripts';
import { runScript } from './features/scripts/runScript';
import { registerScriptRuntimeWatcher } from './features/scripts/scriptRuntime';
import { registerXmlFormatter } from './features/xml/xmlFormatter';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const featureTree = new FeatureTreeProvider();

	context.subscriptions.push(
		featureTree,
		vscode.window.registerTreeDataProvider(FeatureTreeProvider.viewType, featureTree),
		vscode.commands.registerCommand('vscode-toolkit.openLaunchd', () =>
			LaunchdPanel.show(context.extensionUri),
		),
		vscode.commands.registerCommand('vscode-toolkit.generateGitignore', () =>
			generateGitignore(context.extensionUri),
		),
		...['runDotnetScript', 'runShScript', 'runBatScript', 'runNodeScript', 'runBunScript'].map(
			command =>
				vscode.commands.registerCommand(`vscode-toolkit.${command}`, (uri, selectedUris) =>
					runScript(context, uri, selectedUris),
				),
		),
		vscode.commands.registerCommand('vscode-toolkit.runNpmScript', runNpmScript),
		vscode.commands.registerCommand('vscode-toolkit.runBunPackageScript', runNpmScript),
		registerXmlFormatter(),
	);
	registerNpmScriptWatcher(context);
	registerScriptRuntimeWatcher(context);
	registerSourceControl(context);
	registerHttpClient(context);
	await registerChat(context);
	await registerExplorer(context);

	const perfTipsProvider = new PerfTipsProvider();
	context.subscriptions.push(
		vscode.debug.registerDebugAdapterTrackerFactory('*', {
			createDebugAdapterTracker(_session: vscode.DebugSession) {
				return perfTipsProvider;
			},
		}),
	);
}

export function deactivate(): void {}
