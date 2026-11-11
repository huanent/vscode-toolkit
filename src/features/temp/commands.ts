import * as vscode from 'vscode';
import * as path from 'node:path';
import { resolveStorageRoots } from '@/host/utils/storage';
import { findStorageRoot, isStorageScope, type StorageScope } from '@/shared/storage-scope';
import { mkdir, writeFile } from 'node:fs/promises';
import type { FileClipboard } from '@/host/utils/file-clipboard';
import type { TempContextTarget, TempEntryType, TempTreeEntry } from './protocol';
import { createTempAutoSaveScheduler } from './auto-save';
import { createTempFileUri, registerTempFileSystem } from './file-system';
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
export function registerTempCommands(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  clipboard: FileClipboard,
): void {
  const autoSaveScheduler = createTempAutoSaveScheduler();
  const copyTemp = async (target: unknown, cut: boolean) => {
    const entry = parseTempTarget(target);
    if (!entry.tempEntryPath || !entry.tempEntryType) return;
    const directory = getTempDirectory(context, entry.tempScope);
    const source = entry.tempEntryType === 'directory'
      ? await resolveTempDirectory(directory, entry.tempEntryPath)
      : await getTempFilePath(directory, entry.tempEntryPath);
    await clipboard.write([vscode.Uri.file(source)], cut);
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.temp.copy', (target: unknown) =>
      copyTemp(target, false).catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.temp.cut', (target: unknown) =>
      copyTemp(target, true).catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.files.copy', (resource?: vscode.Uri, selection?: vscode.Uri[]) =>
      clipboard.copyExplorer(false, resource, selection).catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.files.cut', (resource?: vscode.Uri, selection?: vscode.Uri[]) =>
      clipboard.copyExplorer(true, resource, selection).catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.files.paste', (resource?: vscode.Uri) =>
      clipboard.pasteExplorer(resource).catch(showTempCommandError),
    ),
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
    vscode.commands.registerCommand('toolkit.temp.moveToWorkspace', (target: unknown) =>
      moveTempEntryToScope(context, refresh, target, 'workspace').catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.temp.moveBackGlobal', (target: unknown) =>
      moveTempEntryToScope(context, refresh, target, 'global').catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.temp.paste', (target: unknown) =>
      resolveTargetDirectory(context, parseTempTarget(target))
        .then((directory) => clipboard.paste(vscode.Uri.file(directory)))
        .catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.temp.copyPath', (target: unknown) =>
      copyTempEntryPath(context, target).catch(showTempCommandError),
    ),
  );
}

function getTempDirectory(context: vscode.ExtensionContext, scope: StorageScope = 'global'): string {
  return findStorageRoot(resolveStorageRoots(context, 'temp'), scope).directory;
}

async function copyTempEntryPath(context: vscode.ExtensionContext, target: unknown): Promise<void> {
  const entry = parseTempTarget(target);
  if (!entry.tempEntryPath || !entry.tempEntryType) return;
  const directory = getTempDirectory(context, entry.tempScope);
  const entryPath =
    entry.tempEntryType === 'directory'
      ? await resolveTempDirectory(directory, entry.tempEntryPath)
      : await getTempFilePath(directory, entry.tempEntryPath);
  await vscode.env.clipboard.writeText(entryPath);
}

async function moveTempEntryFromInput(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
): Promise<void> {
  const entry = parseTempTarget(target);
  if (!entry.tempEntryPath || !entry.tempEntryType) return;

  const sourceScope = entry.tempScope ?? 'global';
  const sourcePath = entry.tempEntryPath;
  const directory = getTempDirectory(context, sourceScope);
  if (entry.tempEntryType === 'directory') await resolveTempDirectory(directory, sourcePath);
  else await getTempFilePath(directory, sourcePath);

  const destinations: Array<vscode.QuickPickItem & { scope: StorageScope; folderPath?: string }> = [];
  for (const root of resolveStorageRoots(context, 'temp').filter((root) => root.scope === sourceScope)) {
    const label = root.scope === 'global' ? 'Global' : 'Workspace';
    destinations.push({ label: 'Root', description: label, scope: root.scope });
    const collectFolders = (entries: readonly TempTreeEntry[], parent = '') => {
      for (const child of entries) {
        if (child.type !== 'directory') continue;
        const folderPath = parent ? `${parent}/${child.name}` : child.name;
        if (root.scope === sourceScope && entry.tempEntryType === 'directory' &&
            (folderPath === sourcePath || folderPath.startsWith(`${sourcePath}/`))) continue;
        destinations.push({ label: folderPath, description: label, scope: root.scope, folderPath });
        collectFolders(child.children ?? [], folderPath);
      }
    };
    collectFolders(await readTempTree(root.directory));
  }

  const selected = await vscode.window.showQuickPick(destinations, {
    title: 'Move to Folder', placeHolder: 'Select a destination folder',
  });
  if (!selected) return;
  const currentParent = path.posix.dirname(sourcePath);
  if (selected.scope === sourceScope && (currentParent === '.' ? undefined : currentParent) === selected.folderPath) return;

  const name = path.posix.basename(sourcePath);
  const destinationPath = selected.folderPath ? `${selected.folderPath}/${name}` : name;
  await moveTempEntry(context, refresh, sourcePath, sourceScope, destinationPath, selected.scope);
}

async function moveTempEntryToScope(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
  destinationScope: StorageScope,
): Promise<void> {
  const entry = parseTempTarget(target);
  if (!entry.tempEntryPath || !entry.tempEntryType) return;
  const sourceScope = entry.tempScope ?? 'global';
  if (sourceScope === destinationScope) return;
  const directory = getTempDirectory(context, sourceScope);
  if (entry.tempEntryType === 'directory') await resolveTempDirectory(directory, entry.tempEntryPath);
  else await getTempFilePath(directory, entry.tempEntryPath);

  await moveTempEntry(
    context, refresh, entry.tempEntryPath, sourceScope, path.posix.basename(entry.tempEntryPath), destinationScope,
  );
}

async function moveTempEntry(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  sourcePath: string,
  sourceScope: StorageScope,
  destinationPath: string,
  destinationScope: StorageScope,
): Promise<void> {
  const destinationDirectory = getTempDirectory(context, destinationScope);
  await mkdir(destinationDirectory, { recursive: true });
  if (destinationScope === 'workspace') {
    try {
      await writeFile(path.join(destinationDirectory, '.gitignore'), '*\n', { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  await vscode.workspace.fs.rename(createTempFileUri(sourcePath, sourceScope), createTempFileUri(destinationPath, destinationScope));
  await refresh();
}

async function createTempEntry(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  type: TempEntryType,
  target: unknown,
): Promise<void> {
  const isFile = type === 'file';
  const entry = parseTempTarget(target);
  const directory = await resolveTargetDirectory(context, entry);
  const name = await vscode.window.showInputBox({
    prompt: isFile ? 'Name the temporary file' : 'Folder name',
    placeHolder: isFile ? 'scratch.md' : 'drafts',
    validateInput: isFile ? validateTempFileName : validateTempFolderName,
  });
  if (name === undefined) return;

  if (isFile) {
    const filePath = await createTempFile(directory, name);
    await refresh();
    const relativePath = path.relative(getTempDirectory(context, entry.tempScope), filePath);
    await vscode.commands.executeCommand('vscode.open', createTempFileUri(relativePath, entry.tempScope));
    return;
  }

  await createTempDirectory(directory, name);
  await refresh();
}

/** New entries go into the right-clicked folder, or next to the right-clicked file. */
async function resolveTargetDirectory(context: vscode.ExtensionContext, target: TempContextTarget): Promise<string> {
  const directory = getTempDirectory(context, target.tempScope);
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
  await vscode.workspace.fs.rename(createTempFileUri(entry.tempEntryPath, entry.tempScope), createTempFileUri(renamedPath, entry.tempScope));
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

  await vscode.workspace.fs.delete(createTempFileUri(entry.tempEntryPath, entry.tempScope), { recursive: isFolder });
  await closeTabsForPath(entry.tempEntryPath, entry.tempScope);
  await refresh();
}

/** Keeps editors from lingering on files that no longer exist. */
async function closeTabsForPath(relativePath: string, scope?: StorageScope): Promise<void> {
  const targetUri = createTempFileUri(relativePath, scope);
  const targetPath = targetUri.path.replace(/\/$/, '');
  const tabs = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => {
      const input = tab.input;
      if (!(input instanceof vscode.TabInputText)) return false;
      if (input.uri.scheme !== targetUri.scheme || input.uri.authority !== targetUri.authority) return false;
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
    tempScope: isStorageScope(target.tempScope) ? target.tempScope : undefined,
    tempEntryPath: typeof target.tempEntryPath === 'string' ? target.tempEntryPath : undefined,
    tempEntryType:
      target.tempEntryType === 'file' || target.tempEntryType === 'directory' ? target.tempEntryType : undefined,
  };
}

function showTempCommandError(error: unknown): void {
  void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error), { modal: true });
}
