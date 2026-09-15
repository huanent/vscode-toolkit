import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const gitRepositoryFoldersContext = 'vscode-toolkit.gitRepositoryFolders';
const execFileAsync = promisify(execFile);
const gitTimeout = 15_000;

const gitCommands = {
	pullGitRepository: 'git pull',
	pushGitRepository: 'git push',
	fetchGitRepository: 'git fetch --all --prune',
} as const;

export function registerSourceControl(context: vscode.ExtensionContext): void {
	const gitRepositoryBranches = new Map<string, string>();
	const gitDecorationEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;
	let generation = 0;
	let disposed = false;
	let refreshing = false;

	async function refresh(): Promise<void> {
		if (disposed || refreshing) {
			return;
		}
		refreshing = true;
		const currentGeneration = generation;
		try {
			const repositories = await readGitRepositoryFolders();
			if (disposed || currentGeneration !== generation) {
				return;
			}
			gitRepositoryBranches.clear();
			for (const [uri, branch] of repositories) {
				if (branch) {
					gitRepositoryBranches.set(uri.fsPath, branch);
				}
			}
			await vscode.commands.executeCommand(
				'setContext',
				gitRepositoryFoldersContext,
				Object.fromEntries(repositories.map(([uri]) => [uri.fsPath, true])),
			);
			if (!disposed) {
				gitDecorationEmitter.fire(undefined);
			}
		} catch (error) {
			console.error('Unable to refresh Git repositories.', error);
		} finally {
			refreshing = false;
			if (!disposed && currentGeneration !== generation) {
				scheduleRefresh();
			}
		}
	}

	function scheduleRefresh(): void {
		generation++;
		clearTimeout(refreshTimer);
		if (!disposed) {
			refreshTimer = setTimeout(() => void refresh(), 200);
		}
	}

	for (const [command, gitCommand] of Object.entries(gitCommands)) {
		context.subscriptions.push(
			vscode.commands.registerCommand(
				`vscode-toolkit.${command}`,
				(folderUri: vscode.Uri | undefined) => {
					if (!folderUri) {
						return;
					}

					const terminal = vscode.window.createTerminal({ name: 'Toolkit Git', cwd: folderUri });
					terminal.show();
					terminal.sendText(gitCommand);
				},
			),
		);
	}
	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-toolkit.checkoutGitRepository', async (uri: vscode.Uri | undefined) => {
			if (await checkoutGitRepository(uri)) {
				scheduleRefresh();
			}
		}),
		vscode.window.registerFileDecorationProvider({
			onDidChangeFileDecorations: gitDecorationEmitter.event,
			provideFileDecoration(uri) {
				const branch = gitRepositoryBranches.get(uri.fsPath);
				return branch ? new vscode.FileDecoration(undefined, `Git branch: ${branch}`) : undefined;
			},
		}),
	);

	const gitWatcher = vscode.workspace.createFileSystemWatcher('**/.git/HEAD');
	gitWatcher.onDidCreate(scheduleRefresh, undefined, context.subscriptions);
	gitWatcher.onDidChange(scheduleRefresh, undefined, context.subscriptions);
	gitWatcher.onDidDelete(scheduleRefresh, undefined, context.subscriptions);

	const gitFileWatcher = vscode.workspace.createFileSystemWatcher('**/.git');
	gitFileWatcher.onDidCreate(scheduleRefresh, undefined, context.subscriptions);
	gitFileWatcher.onDidChange(scheduleRefresh, undefined, context.subscriptions);
	gitFileWatcher.onDidDelete(scheduleRefresh, undefined, context.subscriptions);

	context.subscriptions.push(
		gitDecorationEmitter,
		gitWatcher,
		gitFileWatcher,
		vscode.workspace.onDidChangeWorkspaceFolders(scheduleRefresh),
		{ dispose() { disposed = true; clearTimeout(refreshTimer); } },
	);
	void refresh();
}

async function checkoutGitRepository(folderUri: vscode.Uri | undefined): Promise<boolean> {
	if (!folderUri || folderUri.scheme !== 'file') {
		return false;
	}

	type BranchItem = vscode.QuickPickItem & { branch: string; remote: boolean; current: boolean };
	let branches: BranchItem[];
	try {
		const { stdout } = await execFileAsync(
			'git',
			[
				'for-each-ref',
				'--format=%(refname)\t%(refname:short)\t%(HEAD)\t%(symref)',
				'refs/heads',
				'refs/remotes',
			],
			{ cwd: folderUri.fsPath, timeout: gitTimeout },
		);
		branches = stdout
			.trim()
			.split('\n')
			.filter(Boolean)
			.flatMap(line => {
				const [ref, branch, head, symbolicRef] = line.split('\t');
				const remote = ref.startsWith('refs/remotes/');
				if (symbolicRef) {
					return [];
				}

				return [
					{
						label: branch,
						description: head === '*' ? 'Current' : remote ? 'Remote' : 'Local',
						branch: remote ? ref : ref.slice('refs/heads/'.length),
						remote,
						current: head === '*',
					},
				];
			});
	} catch {
		void vscode.window.showErrorMessage('Unable to read Git branches for this repository.');
		return false;
	}

	if (!branches.length) {
		void vscode.window.showInformationMessage('No Git branches found in this repository.');
		return false;
	}
	const selected = await vscode.window.showQuickPick(branches, {
		placeHolder: 'Select a branch to check out',
		title: 'Checkout to...',
	});
	if (!selected || selected.current) {
		return false;
	}

	try {
		await execFileAsync('git', selected.remote
			? ['switch', '--track', '--', selected.branch]
			: ['switch', '--', selected.branch], { cwd: folderUri.fsPath, timeout: gitTimeout });
		return true;
	} catch (error) {
		void vscode.window.showErrorMessage(`Unable to switch Git branch: ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
}

async function readGitRepositoryFolders(): Promise<Array<[vscode.Uri, string | undefined]>> {
	const [headUris, gitFileUris] = await Promise.all([
		vscode.workspace.findFiles('**/.git/HEAD', null),
		vscode.workspace.findFiles('**/.git', null),
	]);
	const repositories = new Map<string, vscode.Uri>();

	for (const markerUri of [...headUris, ...gitFileUris]) {
		if (markerUri.scheme !== 'file') {
			continue;
		}
		const gitUri = markerUri.path.endsWith('/HEAD')
			? vscode.Uri.joinPath(markerUri, '..')
			: markerUri;
		const repositoryUri = vscode.Uri.joinPath(gitUri, '..');
		repositories.set(repositoryUri.fsPath, repositoryUri);
	}

	return Promise.all([...repositories.values()].map(async uri => [uri, await getCurrentBranch(uri)]));
}

async function getCurrentBranch(repositoryUri: vscode.Uri): Promise<string | undefined> {
	try {
		const { stdout } = await execFileAsync('git', ['symbolic-ref', '--short', 'HEAD'], {
			cwd: repositoryUri.fsPath,
			timeout: gitTimeout,
		});
		return stdout.trim() || undefined;
	} catch {
		return undefined;
	}
}

