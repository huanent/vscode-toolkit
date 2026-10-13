import * as vscode from 'vscode';
import * as path from 'node:path';
import { resolveStorageDirectory } from '@/host/utils/storage';
import type { TempContextTarget, TempEntryType, TempTreeEntry } from './protocol';
import { createTempAutoSaveScheduler } from './auto-save';
import { createTempFileUri, registerTempFileSystem } from './file-system';
import { showFolderPicker } from '@/host/utils/folder-picker';
import {
  createTempDirectory,
  createTempFile,
  getTempFilePath,
  readTempTree,
  resolveTempDirectory,
  validateTempFileName,
  validateTempFolderName,
} from './service';

/**
 * Registers the temp commands. They are invoked from the native
 * `webview/context` menu of the dashboard temp panel, which passes the
 * right-clicked entry as the command argument.
 */
export function registerTempCommands(context: vscode.ExtensionContext, refresh: () => Promise<void>): void {
  const autoSaveScheduler = createTempAutoSaveScheduler();
  context.subscriptions.push(
    registerTempFileSystem(context),
    vscode.workspace.onDidChangeTextDocument(({ document }) => autoSaveScheduler.schedule(document)),
    vscode.workspace.onDidSaveTextDocument(autoSaveScheduler.cancel),
    vscode.workspace.onDidCloseTextDocument(autoSaveScheduler.cancel),
    { dispose: () => autoSaveScheduler.dispose() },
    vscode.commands.registerCommand('toolkit.temp.createFile', (target: unknown) =>
      createTempEntry(context, refresh, 'file', target).catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.temp.createFolder', (target: unknown) =>
      createTempEntry(context, refresh, 'directory', target).catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.temp.rename', (target: unknown) =>
      renameTempEntryFromInput(refresh, target).catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.temp.delete', (target: unknown) =>
      deleteTempEntryFromInput(refresh, target).catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.temp.move', (target: unknown) =>
      moveTempEntryFromInput(context, refresh, target).catch(showTempCommandError),
    ),
  );
}

async function moveTempEntryFromInput(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
): Promise<void> {
  const entry = parseTempTarget(target);
  if (!entry.tempEntryPath || !entry.tempEntryType) return;

  const directory = resolveStorageDirectory(context, 'temp');
  const tree = await readTempTree(directory);
  const destinations: string[] = [];
  const collectFolders = (entries: readonly TempTreeEntry[], parent = '') => {
    for (const child of entries) {
      if (child.type !== 'directory') continue;
      const relativePath = parent ? `${parent}/${child.name}` : child.name;
      destinations.push(relativePath);
      collectFolders(child.children ?? [], relativePath);
    }
  };
  collectFolders(tree);

  const sourcePath = entry.tempEntryPath;
  if (entry.tempEntryType === 'directory') {
    await resolveTempDirectory(directory, sourcePath);
    for (let index = destinations.length - 1; index > 0; index--) {
      const folder = destinations[index];
      if (folder === sourcePath || folder.startsWith(`${sourcePath}/`)) destinations.splice(index, 1);
    }
  } else {
    await getTempFilePath(directory, sourcePath);
  }

  const selected = await showFolderPicker(destinations);
  if (!selected) return;
  const currentParent = path.posix.dirname(sourcePath);
  if ((currentParent === '.' ? undefined : currentParent) === selected.folderPath) return;

  const name = path.posix.basename(sourcePath);
  const destinationPath = selected.folderPath ? `${selected.folderPath}/${name}` : name;
  await vscode.workspace.fs.rename(createTempFileUri(sourcePath), createTempFileUri(destinationPath));
  await refresh();
}

async function createTempEntry(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  type: TempEntryType,
  target: unknown,
): Promise<void> {
  const isFile = type === 'file';
  const directory = await resolveTargetDirectory(context, parseTempTarget(target));
  const name = await vscode.window.showInputBox({
    prompt: isFile ? 'Name the temporary file' : 'Folder name',
    placeHolder: isFile ? 'scratch.md' : 'drafts',
    validateInput: isFile ? validateTempFileName : validateTempFolderName,
  });
  if (name === undefined) return;

  if (isFile) {
    const filePath = await createTempFile(directory, name);
    await refresh();
    const relativePath = path.relative(resolveStorageDirectory(context, 'temp'), filePath);
    await vscode.commands.executeCommand('vscode.open', createTempFileUri(relativePath));
    return;
  }

  await createTempDirectory(directory, name);
  await refresh();
}

/** New entries go into the right-clicked folder, or next to the right-clicked file. */
async function resolveTargetDirectory(context: vscode.ExtensionContext, target: TempContextTarget): Promise<string> {
  const directory = resolveStorageDirectory(context, 'temp');
  const relativePath = getTargetRelativePath(target);
  if (!relativePath) return directory;
  return resolveTempDirectory(directory, relativePath);
}

async function renameTempEntryFromInput(refresh: () => Promise<void>, target: unknown): Promise<void> {
  const entry = parseTempTarget(target);
  if (!entry.tempEntryPath) return;

  const isFolder = entry.tempEntryType === 'directory';
  const currentName = getEntryName(entry.tempEntryPath);
  const name = await vscode.window.showInputBox({
    prompt: isFolder ? 'Rename folder' : 'Rename the temporary file',
    value: currentName,
    valueSelection: getRenameSelection(currentName, isFolder),
    validateInput: isFolder ? validateTempFolderName : validateTempFileName,
  });
  if (name === undefined) return;

  const parentPath = path.posix.dirname(entry.tempEntryPath);
  const renamedPath = path.posix.join(parentPath, name.trim());
  await vscode.workspace.fs.rename(createTempFileUri(entry.tempEntryPath), createTempFileUri(renamedPath));
  await refresh();
}

async function deleteTempEntryFromInput(refresh: () => Promise<void>, target: unknown): Promise<void> {
  const entry = parseTempTarget(target);
  if (!entry.tempEntryPath) return;

  const isFolder = entry.tempEntryType === 'directory';
  const label = isFolder ? 'folder' : 'file';
  const confirmation = await vscode.window.showWarningMessage(
    isFolder
      ? `Delete folder "${getEntryName(entry.tempEntryPath)}" and all its contents?`
      : `Delete temporary ${label} "${getEntryName(entry.tempEntryPath)}"?`,
    { modal: true, detail: isFolder ? 'The folder and everything inside it is removed from disk.' : undefined },
    'Delete',
  );
  if (confirmation !== 'Delete') return;

  await vscode.workspace.fs.delete(createTempFileUri(entry.tempEntryPath), { recursive: isFolder });
  await closeTabsForPath(entry.tempEntryPath);
  await refresh();
}

/** Keeps editors from lingering on files that no longer exist. */
async function closeTabsForPath(relativePath: string): Promise<void> {
  const targetUri = createTempFileUri(relativePath);
  const targetPath = targetUri.path.replace(/\/$/, '');
  const tabs = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => {
      const input = tab.input;
      if (!(input instanceof vscode.TabInputText)) return false;
      if (input.uri.scheme !== targetUri.scheme) return false;
      return input.uri.path === targetPath || input.uri.path.startsWith(`${targetPath}/`);
    });
  if (tabs.length) await vscode.window.tabGroups.close(tabs);
}

function getTargetRelativePath(target: TempContextTarget): string | undefined {
  if (!target.tempEntryPath) return undefined;
  if (target.tempEntryType !== 'file') return target.tempEntryPath;

  const separatorIndex = target.tempEntryPath.lastIndexOf('/');
  return separatorIndex === -1 ? undefined : target.tempEntryPath.slice(0, separatorIndex);
}

function getEntryName(relativePath: string): string {
  return relativePath.slice(relativePath.lastIndexOf('/') + 1);
}

/** Selects the file name without its extension, and the whole name for folders. */
function getRenameSelection(name: string, isFolder: boolean): [number, number] {
  const extensionIndex = isFolder ? -1 : name.lastIndexOf('.');
  return [0, extensionIndex > 0 ? extensionIndex : name.length];
}

function parseTempTarget(value: unknown): TempContextTarget {
  if (typeof value !== 'object' || value === null) return {};
  const target = value as Record<string, unknown>;
  return {
    tempEntryPath: typeof target.tempEntryPath === 'string' ? target.tempEntryPath : undefined,
    tempEntryType:
      target.tempEntryType === 'file' || target.tempEntryType === 'directory' ? target.tempEntryType : undefined,
  };
}

function showTempCommandError(error: unknown): void {
  void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
}
