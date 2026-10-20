import { posix } from 'node:path';
import * as vscode from 'vscode';

type ExplorerContextTarget = {
  explorerDirectoryUri?: string;
  explorerEntryUri?: string;
  explorerEntryType?: 'file' | 'directory';
  explorerSelectedUris?: string[];
};

export function registerExplorerContextCommands(context: vscode.ExtensionContext, refresh: () => Promise<void>): void {
  const register = (command: string, action: (target: ExplorerContextTarget) => Promise<void>) =>
    vscode.commands.registerCommand(command, async (value: unknown) => {
      if (typeof value !== 'object' || value === null) return;
      const target = value as ExplorerContextTarget;
      if (typeof target.explorerDirectoryUri !== 'string') return;
      if (target.explorerEntryUri !== undefined && typeof target.explorerEntryUri !== 'string') return;
      if (
        target.explorerSelectedUris !== undefined &&
        (!Array.isArray(target.explorerSelectedUris) ||
          !target.explorerSelectedUris.every((uri) => typeof uri === 'string'))
      )
        return;
      try {
        await action(target);
      } catch (error) {
        void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error), { modal: true });
      }
    });

  context.subscriptions.push(
    register('toolkit.explorer.createFile', (target) => createEntry(target, 'file', refresh)),
    register('toolkit.explorer.createFolder', (target) => createEntry(target, 'directory', refresh)),
    register('toolkit.explorer.openInTerminal', async (target) => {
      const terminal = vscode.window.createTerminal({ cwd: resolveTargetDirectory(target) });
      context.subscriptions.push(terminal);
      terminal.show();
    }),
    register('toolkit.explorer.openInCurrentWindow', async (target) => {
      await vscode.commands.executeCommand('vscode.openFolder', resolveTargetDirectory(target), {
        forceReuseWindow: true,
      });
    }),
    register('toolkit.explorer.openInNewWindow', async (target) => {
      await vscode.commands.executeCommand('vscode.openFolder', resolveTargetDirectory(target), {
        forceNewWindow: true,
      });
    }),
    register('toolkit.explorer.delete', async (target) => {
      if (!target.explorerEntryUri) return;
      const selectedUris = target.explorerSelectedUris?.includes(target.explorerEntryUri)
        ? target.explorerSelectedUris
        : [target.explorerEntryUri];
      const uris = [...new Set(selectedUris)].map((uri) => vscode.Uri.parse(uri));
      const confirmation = await vscode.window.showWarningMessage(
        uris.length === 1 ? `Delete "${posix.basename(uris[0]!.path)}"?` : `Delete ${uris.length} selected items?`,
        {
          modal: true,
          detail: [
            ...(uris.length > 1 ? [uris.map((uri) => posix.basename(uri.path)).join('\n')] : []),
            'Folders and all their contents will be deleted. The trash will be used when available.',
          ].join('\n\n'),
        },
        'Delete',
      );
      if (confirmation !== 'Delete') return;
      try {
        for (const uri of uris) {
          await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
        }
      } finally {
        await refresh();
      }
    }),
    register('toolkit.explorer.copyPath', async (target) => {
      if (!target.explorerEntryUri) return;
      await vscode.env.clipboard.writeText(vscode.Uri.parse(target.explorerEntryUri).fsPath);
    }),
  );
}

function resolveTargetDirectory(target: ExplorerContextTarget): vscode.Uri {
  return target.explorerEntryUri
    ? target.explorerEntryType === 'directory'
      ? vscode.Uri.parse(target.explorerEntryUri)
      : vscode.Uri.joinPath(vscode.Uri.parse(target.explorerEntryUri), '..')
    : vscode.Uri.parse(target.explorerDirectoryUri!);
}

async function createEntry(
  target: ExplorerContextTarget,
  type: 'file' | 'directory',
  refresh: () => Promise<void>,
): Promise<void> {
  const parent = resolveTargetDirectory(target);
  const name = await vscode.window.showInputBox({
    prompt: type === 'file' ? 'New file name' : 'New folder name',
    validateInput: async (value) => {
      const name = value.trim();
      if (
        !name ||
        name === '.' ||
        name === '..' ||
        /[\\/]/.test(name) ||
        Array.from(name).some((character) => character.charCodeAt(0) < 32)
      )
        return 'Enter a valid name without path separators.';
      try {
        await vscode.workspace.fs.stat(vscode.Uri.joinPath(parent, name));
        return 'A file or folder with this name already exists.';
      } catch (error) {
        if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') return undefined;
        return error instanceof Error ? error.message : String(error);
      }
    },
  });
  if (name === undefined) return;
  const uri = vscode.Uri.joinPath(parent, name.trim());
  if (type === 'file') {
    const edit = new vscode.WorkspaceEdit();
    edit.createFile(uri, { overwrite: false });
    if (!(await vscode.workspace.applyEdit(edit))) throw new Error('Unable to create the file.');
  } else {
    await vscode.workspace.fs.createDirectory(uri);
  }
  await refresh();
}
