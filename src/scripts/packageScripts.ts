import * as vscode from 'vscode';
import { getScriptRuntime } from './scriptRuntime';

const npmScriptFoldersContext = 'vscode-toolkit.npmScriptFolders';
const bunScriptFoldersContext = 'vscode-toolkit.bunScriptFolders';

type PackageJson = {
	scripts?: Record<string, unknown>;
};

export async function runPackageScript(folderUri: vscode.Uri | undefined): Promise<void> {
	if (!folderUri) {
		return;
	}

	const runtime = await getScriptRuntime(folderUri);
	const scripts = await getScripts(folderUri);
	if (scripts.length === 0) {
		void vscode.window.showInformationMessage('No package scripts found in this folder.');
		await refreshPackageScriptFolders();
		return;
	}

	const selected = await vscode.window.showQuickPick(
		scripts.map(([label, description]) => ({ label, description })),
		{
			placeHolder: `Select a script to run with ${runtime}`,
			title: runtime === 'bun' ? 'Run Bun Script' : 'Run npm Script',
		},
	);
	if (!selected) {
		return;
	}

	const terminal = vscode.window.createTerminal({ name: `Toolkit ${runtime}`, cwd: folderUri });
	terminal.show();
	terminal.sendText(`${runtime === 'bun' ? 'bun' : 'npm'} run ${quoteArgument(selected.label)}`);
}

export function registerPackageScriptWatcher(context: vscode.ExtensionContext): void {
	const packageJsonWatcher = vscode.workspace.createFileSystemWatcher('**/package.json');
	packageJsonWatcher.onDidCreate(refreshPackageScriptFolders, undefined, context.subscriptions);
	packageJsonWatcher.onDidChange(refreshPackageScriptFolders, undefined, context.subscriptions);
	packageJsonWatcher.onDidDelete(refreshPackageScriptFolders, undefined, context.subscriptions);

	const bunMarkerWatcher = vscode.workspace.createFileSystemWatcher('**/{bun.lock,bunfig.toml}');
	bunMarkerWatcher.onDidCreate(refreshPackageScriptFolders, undefined, context.subscriptions);
	bunMarkerWatcher.onDidDelete(refreshPackageScriptFolders, undefined, context.subscriptions);

	context.subscriptions.push(
		packageJsonWatcher,
		bunMarkerWatcher,
		vscode.workspace.onDidChangeWorkspaceFolders(refreshPackageScriptFolders),
	);
	void refreshPackageScriptFolders();
}

async function getScripts(folderUri: vscode.Uri): Promise<Array<[string, string]>> {
	try {
		const content = await vscode.workspace.fs.readFile(
			vscode.Uri.joinPath(folderUri, 'package.json'),
		);
		const packageJson = JSON.parse(Buffer.from(content).toString('utf8')) as PackageJson;
		if (!packageJson.scripts || typeof packageJson.scripts !== 'object') {
			return [];
		}

		return Object.entries(packageJson.scripts)
			.filter((entry): entry is [string, string] => typeof entry[1] === 'string')
			.sort(([left], [right]) => left.localeCompare(right));
	} catch {
		return [];
	}
}

async function refreshPackageScriptFolders(): Promise<void> {
	const packageJsonUris = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**');
	const npmFolders: Record<string, boolean> = {};
	const bunFolders: Record<string, boolean> = {};

	await Promise.all(
		packageJsonUris.map(async packageJsonUri => {
			const folderUri = vscode.Uri.joinPath(packageJsonUri, '..');
			if ((await getScripts(folderUri)).length > 0) {
				const folders = (await getScriptRuntime(folderUri)) === 'bun' ? bunFolders : npmFolders;
				folders[folderUri.fsPath] = true;
			}
		}),
	);

	await Promise.all([
		vscode.commands.executeCommand('setContext', npmScriptFoldersContext, npmFolders),
		vscode.commands.executeCommand('setContext', bunScriptFoldersContext, bunFolders),
	]);
}

function quoteArgument(value: string): string {
	return `"${value.replaceAll('"', '\\"')}"`;
}