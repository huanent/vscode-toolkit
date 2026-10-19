import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const gitRepositoryFoldersContext = 'toolkit.gitRepositoryFolders';
const execFileAsync = promisify(execFile);
const gitTimeout = 15_000;

const gitCommands = {
  statusGitRepository: 'git status',
  pullGitRepository: 'git pull',
  pushGitRepository: 'git push',
  fetchGitRepository: 'git fetch --all --prune',
} as const;

export function registerSourceControl(context: vscode.ExtensionContext): void {
  const folders = new Map<string, { repository: boolean; detection: Promise<undefined> }>();
  const gitDecorationEmitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  let contextTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function updateContext(): void {
    clearTimeout(contextTimer);
    if (!disposed) {
      contextTimer = setTimeout(() => {
        void vscode.commands.executeCommand(
          'setContext',
          gitRepositoryFoldersContext,
          Object.fromEntries([...folders].filter(([, folder]) => folder.repository).map(([path]) => [path, true])),
        );
      }, 0);
    }
  }

  function invalidate(uri: vscode.Uri): void {
    if (!disposed) {
      folders.delete(uri.fsPath);
      updateContext();
      gitDecorationEmitter.fire(uri);
    }
  }

  function reset(): void {
    folders.clear();
    updateContext();
    if (!disposed) {
      gitDecorationEmitter.fire(undefined);
    }
  }

  function detectRepository(uri: vscode.Uri): Promise<undefined> | undefined {
    if (disposed || uri.scheme !== 'file') {
      return undefined;
    }
    const cached = folders.get(uri.fsPath);
    if (cached) {
      return cached.detection;
    }

    const folder = { repository: false, detection: Promise.resolve<undefined>(undefined) };
    folders.set(uri.fsPath, folder);
    folder.detection = (async () => {
      try {
        const marker = await vscode.workspace.fs.stat(vscode.Uri.joinPath(uri, '.git'));
        if (!(marker.type & (vscode.FileType.File | vscode.FileType.Directory))) {
          return undefined;
        }
      } catch {
        return;
      }
      if (disposed || folders.get(uri.fsPath) !== folder) {
        return undefined;
      }
      folder.repository = true;
      updateContext();
      return undefined;
    })();
    return folder.detection;
  }

  for (const [command, gitCommand] of Object.entries(gitCommands)) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`toolkit.${command}`, (folderUri: vscode.Uri | undefined) => {
        if (!folderUri) {
          return;
        }

        const terminal = vscode.window.createTerminal({ name: 'Toolkit Git', cwd: folderUri });
        terminal.show();
        terminal.sendText(gitCommand);
      }),
    );
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.checkoutGitRepository', async (uri: vscode.Uri | undefined) => {
      if (await checkoutGitRepository(uri)) {
        invalidate(uri!);
      }
    }),
    vscode.window.registerFileDecorationProvider({
      onDidChangeFileDecorations: gitDecorationEmitter.event,
      provideFileDecoration: detectRepository,
    }),
  );

  const gitFileWatcher = vscode.workspace.createFileSystemWatcher('**/.git');
  const invalidateMarker = (uri: vscode.Uri) => invalidate(vscode.Uri.joinPath(uri, '..'));
  gitFileWatcher.onDidCreate(invalidateMarker, undefined, context.subscriptions);
  gitFileWatcher.onDidChange(invalidateMarker, undefined, context.subscriptions);
  gitFileWatcher.onDidDelete(invalidateMarker, undefined, context.subscriptions);

  context.subscriptions.push(
    gitDecorationEmitter,
    gitFileWatcher,
    vscode.workspace.onDidChangeWorkspaceFolders(reset),
    vscode.workspace.onDidRenameFiles(reset),
    vscode.workspace.onDidDeleteFiles(reset),
    {
      dispose() {
        disposed = true;
        clearTimeout(contextTimer);
        folders.clear();
      },
    },
  );
  updateContext();
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
      ['for-each-ref', '--format=%(refname)\t%(refname:short)\t%(HEAD)\t%(symref)', 'refs/heads', 'refs/remotes'],
      { cwd: folderUri.fsPath, timeout: gitTimeout },
    );
    branches = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
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
    void vscode.window.showErrorMessage('Unable to read Git branches for this repository.', { modal: true });
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
    await execFileAsync(
      'git',
      selected.remote ? ['switch', '--track', '--', selected.branch] : ['switch', '--', selected.branch],
      { cwd: folderUri.fsPath, timeout: gitTimeout },
    );
    return true;
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Unable to switch Git branch: ${error instanceof Error ? error.message : String(error)}`,
      { modal: true },
    );
    return false;
  }
}
