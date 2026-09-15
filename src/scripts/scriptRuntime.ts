import { execFileSync } from 'node:child_process';
import * as vscode from 'vscode';

const nodeAvailableContext = 'vscode-toolkit.nodeAvailable';
const npmAvailableContext = 'vscode-toolkit.npmAvailable';
const bunAvailableContext = 'vscode-toolkit.bunAvailable';
const bunWorkspaceContext = 'vscode-toolkit.bunWorkspace';
const bunMarkers = ['bun.lock', 'bunfig.toml'];

export type ScriptRuntime = 'node' | 'bun';

export function registerScriptRuntimeWatcher(context: vscode.ExtensionContext): void {
	const watcher = vscode.workspace.createFileSystemWatcher('**/{bun.lock,bunfig.toml}');
	watcher.onDidCreate(refreshScriptRuntimeContexts, undefined, context.subscriptions);
	watcher.onDidDelete(refreshScriptRuntimeContexts, undefined, context.subscriptions);
	context.subscriptions.push(
		watcher,
		vscode.workspace.onDidChangeWorkspaceFolders(refreshScriptRuntimeContexts),
	);
	void refreshScriptRuntimeContexts();
}

export async function getScriptRuntime(uri: vscode.Uri): Promise<ScriptRuntime> {
	const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
	if (workspaceFolder && (await isBunWorkspaceFolder(workspaceFolder.uri))) {
		return 'bun';
	}

	return 'node';
}

export function getTypeScriptRuntimeArgs(): string[] {
	if (compareVersions(getNodeVersion(), 'v22.6.0') < 0) {
		throw new Error('Running TypeScript requires Node.js 22.6.0 or newer.');
	}

	const help = execFileSync('node', ['--help'], { encoding: 'utf8' });
	const runtimeArgs: string[] = [];

	if (help.includes('--experimental-strip-types')) {
		runtimeArgs.push('--experimental-strip-types');
	}
	if (help.includes('--experimental-transform-types')) {
		runtimeArgs.push('--experimental-transform-types');
	}
	if (runtimeArgs.length > 0) {
		runtimeArgs.push('--no-warnings');
	}

	return runtimeArgs;
}

function getNodeVersion(): string {
	try {
		return execFileSync('node', ['--version'], { encoding: 'utf8' }).trim();
	} catch {
		throw new Error('Node.js SDK is not installed or is not available on PATH.');
	}
}

function compareVersions(left: string, right: string): number {
	const leftParts = left.replace(/^v/, '').split('.').map(Number);
	const rightParts = right.replace(/^v/, '').split('.').map(Number);

	for (let index = 0; index < 3; index += 1) {
		const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
		if (difference !== 0) {
			return difference;
		}
	}

	return 0;
}

function isCommandAvailable(command: ScriptRuntime | 'npm'): boolean {
	try {
		execFileSync(command, ['--version'], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

async function refreshScriptRuntimeContexts(): Promise<void> {
	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	const bunWorkspace =
		workspaceFolders.length > 0 &&
		(await Promise.all(workspaceFolders.map(folder => isBunWorkspaceFolder(folder.uri)))).every(
			Boolean,
		);

	await Promise.all([
		vscode.commands.executeCommand('setContext', nodeAvailableContext, isCommandAvailable('node')),
		vscode.commands.executeCommand('setContext', npmAvailableContext, isCommandAvailable('npm')),
		vscode.commands.executeCommand('setContext', bunAvailableContext, isCommandAvailable('bun')),
		vscode.commands.executeCommand('setContext', bunWorkspaceContext, bunWorkspace),
	]);
}

async function isBunWorkspaceFolder(folderUri: vscode.Uri): Promise<boolean> {
	for (const marker of bunMarkers) {
		try {
			await vscode.workspace.fs.stat(vscode.Uri.joinPath(folderUri, marker));
			return true;
		} catch {}
	}

	return false;
}
