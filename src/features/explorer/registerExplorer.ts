import { homedir } from 'node:os';
import * as vscode from 'vscode';
import { ExplorerManager } from './manager';

type OpenTarget = {
	rootUri: vscode.Uri;
	currentUri: vscode.Uri;
};

async function resolveOpenTarget(argument?: vscode.Uri): Promise<OpenTarget> {
	let currentUri: vscode.Uri;
	if (argument instanceof vscode.Uri) {
		const stat = await vscode.workspace.fs.stat(argument);
		currentUri =
			stat.type & vscode.FileType.Directory ? argument : vscode.Uri.joinPath(argument, '..');
	} else {
		currentUri = vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file(homedir());
	}

	return {
		rootUri: currentUri.with({ path: '/', query: '', fragment: '' }),
		currentUri,
	};
}

export async function registerExplorer(context: vscode.ExtensionContext): Promise<void> {
	const explorerManager = new ExplorerManager(context);
	await explorerManager.initialize();
	explorerManager.register();

	context.subscriptions.push(
		explorerManager,
		vscode.commands.registerCommand(
			'vscode-toolkit.openExplorer',
			async (argument?: vscode.Uri) => {
				if (!argument && explorerManager.revealExplorer()) {
					return;
				}
				const { rootUri, currentUri } = await resolveOpenTarget(argument);
				await explorerManager.openExplorer(rootUri, undefined, {
					currentUri: currentUri.toString(),
					history: [],
				});
			},
		),
		vscode.commands.registerCommand('vscode-toolkit.openExplorerTab', async () => {
			const { rootUri, currentUri } = await resolveOpenTarget();
			await explorerManager.openExplorer(rootUri, undefined, {
				currentUri: currentUri.toString(),
				history: [],
			});
		}),
	);
}
