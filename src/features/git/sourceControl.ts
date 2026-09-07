import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const gitRepositoryFoldersContext = 'vscode-toolkit.gitRepositoryFolders';
const execFileAsync = promisify(execFile);
const gitRepositoryBranches = new Map<string, string>();
const gitDecorationEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();

const gitCommands = {
	pullGitRepository: 'git pull',
	pushGitRepository: 'git push',
	fetchGitRepository: 'git fetch --all --prune',
} as const;

export function registerSourceControl(context: vscode.ExtensionContext): void {
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
		vscode.commands.registerCommand('vscode-toolkit.checkoutGitRepository', checkoutGitRepository),
		vscode.window.registerFileDecorationProvider({
			onDidChangeFileDecorations: gitDecorationEmitter.event,
			provideFileDecoration(uri) {
				const branch = gitRepositoryBranches.get(uri.fsPath);
				return branch ? new vscode.FileDecoration(undefined, `Git branch: ${branch}`) : undefined;
			},
		}),
	);

	const gitWatcher = vscode.workspace.createFileSystemWatcher('**/.git/{HEAD,index}');
	gitWatcher.onDidCreate(refreshGitRepositoryFolders, undefined, context.subscriptions);
	gitWatcher.onDidChange(refreshGitRepositoryFolders, undefined, context.subscriptions);
	gitWatcher.onDidDelete(refreshGitRepositoryFolders, undefined, context.subscriptions);

	const gitFileWatcher = vscode.workspace.createFileSystemWatcher('**/.git');
	gitFileWatcher.onDidCreate(refreshGitRepositoryFolders, undefined, context.subscriptions);
	gitFileWatcher.onDidDelete(refreshGitRepositoryFolders, undefined, context.subscriptions);

	context.subscriptions.push(
		gitDecorationEmitter,
		gitWatcher,
		gitFileWatcher,
		vscode.workspace.onDidChangeWorkspaceFolders(refreshGitRepositoryFolders),
	);
	void refreshGitRepositoryFolders();
}

async function checkoutGitRepository(folderUri: vscode.Uri | undefined): Promise<void> {
	if (!folderUri) {
		return;
	}

	type BranchItem = vscode.QuickPickItem & { branch: string; remote: boolean };
	let branches: BranchItem[];
	try {
		const { stdout } = await execFileAsync(
			'git',
			[
				'for-each-ref',
				'--format=%(refname)\t%(refname:short)\t%(HEAD)',
				'refs/heads',
				'refs/remotes',
			],
			{ cwd: folderUri.fsPath },
		);
		branches = stdout
			.trim()
			.split('\n')
			.filter(Boolean)
			.flatMap(line => {
				const [ref, branch, head] = line.split('\t');
				const remote = ref.startsWith('refs/remotes/');
				if (branch.endsWith('/HEAD')) {
					return [];
				}

				return [
					{
						label: branch,
						description: head === '*' ? 'Current' : remote ? 'Remote' : 'Local',
						branch,
						remote,
					},
				];
			});
	} catch {
		void vscode.window.showErrorMessage('Unable to read Git branches for this repository.');
		return;
	}

	const selected = await vscode.window.showQuickPick(branches, {
		placeHolder: 'Select a branch to check out',
		title: 'Checkout to...',
	});
	if (!selected || selected.description === 'Current') {
		return;
	}

	const terminal = vscode.window.createTerminal({ name: 'Toolkit Git', cwd: folderUri });
	terminal.show();
	const branch = quoteShellArgument(selected.branch);
	terminal.sendText(selected.remote ? `git switch --track ${branch}` : `git switch ${branch}`);
}

async function refreshGitRepositoryFolders(): Promise<void> {
	const [headUris, gitFileUris] = await Promise.all([
		vscode.workspace.findFiles('**/.git/HEAD', null),
		vscode.workspace.findFiles('**/.git', null),
	]);
	const repositoryFolders: Record<string, boolean> = {};
	const repositoryUris: vscode.Uri[] = [];

	for (const markerUri of [...headUris, ...gitFileUris]) {
		const gitUri = markerUri.path.endsWith('/HEAD')
			? vscode.Uri.joinPath(markerUri, '..')
			: markerUri;
		const repositoryUri = vscode.Uri.joinPath(gitUri, '..');
		repositoryFolders[repositoryUri.fsPath] = true;
		repositoryUris.push(repositoryUri);
	}

	const branches = await Promise.all(repositoryUris.map(getCurrentBranch));
	gitRepositoryBranches.clear();
	for (let index = 0; index < repositoryUris.length; index++) {
		const branch = branches[index];
		if (branch) {
			gitRepositoryBranches.set(repositoryUris[index].fsPath, branch);
		}
	}

	await vscode.commands.executeCommand(
		'setContext',
		gitRepositoryFoldersContext,
		repositoryFolders,
	);
	gitDecorationEmitter.fire(undefined);
}

async function getCurrentBranch(repositoryUri: vscode.Uri): Promise<string | undefined> {
	try {
		const { stdout } = await execFileAsync('git', ['symbolic-ref', '--short', 'HEAD'], {
			cwd: repositoryUri.fsPath,
		});
		return stdout.trim() || undefined;
	} catch {
		return undefined;
	}
}

function quoteShellArgument(value: string): string {
	if (process.platform === 'win32') {
		return `"${value.replaceAll('"', '\\"')}"`;
	}

	return `'${value.replaceAll("'", "'\\''")}'`;
}
