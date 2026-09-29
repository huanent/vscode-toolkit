import * as vscode from 'vscode';
import * as path from 'node:path';
import { resolveStorageDirectory } from '@/host/utils/storage';
import type { TempContextTarget, TempEntryType } from './protocol';
import { createTempAutoSaveScheduler } from './auto-save';
import {
  createTempDirectory,
  createTempFile,
  deleteTempEntry,
  renameTempEntry,
  resolveTempDirectory,
  validateTempFileName,
  validateTempFolderName,
} from './service';
import { refreshTempFiles } from './view-handler';

/**
 * Registers the temp commands. They are invoked from the native
 * `webview/context` menu of the dashboard temp panel, which passes the
 * right-clicked entry as the command argument.
 */
export function registerTempCommands(context: vscode.ExtensionContext): void {
  const autoSaveScheduler = createTempAutoSaveScheduler(resolveStorageDirectory(context, 'temp'));
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(({ document }) => autoSaveScheduler.schedule(document)),
    vscode.workspace.onDidSaveTextDocument(autoSaveScheduler.cancel),
    vscode.workspace.onDidCloseTextDocument(autoSaveScheduler.cancel),
    { dispose: () => autoSaveScheduler.dispose() },
    vscode.commands.registerCommand('toolkit.temp.createFile', (target: unknown) =>
      createTempEntry(context, 'file', target).catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.temp.createFolder', (target: unknown) =>
      createTempEntry(context, 'directory', target).catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.temp.rename', (target: unknown) =>
      renameTempEntryFromInput(context, target).catch(showTempCommandError),
    ),
    vscode.commands.registerCommand('toolkit.temp.delete', (target: unknown) =>
      deleteTempEntryFromInput(context, target).catch(showTempCommandError),
    ),
  );
}

async function createTempEntry(context: vscode.ExtensionContext, type: TempEntryType, target: unknown): Promise<void> {
  const isFile = type === 'file';
  const directory = await resolveTargetDirectory(context, parseTempTarget(target));
  const name = await vscode.window.showInputBox({
    prompt: isFile ? 'Name the temporary file' : 'Name the temporary folder',
    placeHolder: isFile ? 'scratch.md' : 'drafts',
    validateInput: isFile ? validateTempFileName : validateTempFolderName,
  });
  if (name === undefined) return;

  if (isFile) {
    const filePath = await createTempFile(directory, name);
    await refreshTempFiles(context);
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    await vscode.window.showTextDocument(document);
    return;
  }

  await createTempDirectory(directory, name);
  await refreshTempFiles(context);
}

/** New entries go into the right-clicked folder, or next to the right-clicked file. */
async function resolveTargetDirectory(context: vscode.ExtensionContext, target: TempContextTarget): Promise<string> {
  const directory = resolveStorageDirectory(context, 'temp');
  const relativePath = getTargetRelativePath(target);
  if (!relativePath) return directory;
  return resolveTempDirectory(directory, relativePath);
}

async function renameTempEntryFromInput(context: vscode.ExtensionContext, target: unknown): Promise<void> {
  const entry = parseTempTarget(target);
  if (!entry.tempEntryPath) return;

  const isFolder = entry.tempEntryType === 'directory';
  const currentName = getEntryName(entry.tempEntryPath);
  const name = await vscode.window.showInputBox({
    prompt: isFolder ? 'Rename the temporary folder' : 'Rename the temporary file',
    value: currentName,
    valueSelection: getRenameSelection(currentName, isFolder),
    validateInput: isFolder ? validateTempFolderName : validateTempFileName,
  });
  if (name === undefined) return;

  await renameTempEntry(resolveStorageDirectory(context, 'temp'), entry.tempEntryPath, name);
  await refreshTempFiles(context);
}

async function deleteTempEntryFromInput(context: vscode.ExtensionContext, target: unknown): Promise<void> {
  const entry = parseTempTarget(target);
  if (!entry.tempEntryPath) return;

  const isFolder = entry.tempEntryType === 'directory';
  const label = isFolder ? 'folder' : 'file';
  const confirmation = await vscode.window.showWarningMessage(
    `Delete temporary ${label} "${getEntryName(entry.tempEntryPath)}"?`,
    { modal: true, detail: isFolder ? 'The folder and everything inside it is removed from disk.' : undefined },
    'Delete',
  );
  if (confirmation !== 'Delete') return;

  const deletedPath = await deleteTempEntry(resolveStorageDirectory(context, 'temp'), entry.tempEntryPath);
  await closeTabsForPath(deletedPath);
  await refreshTempFiles(context);
}

/** Keeps editors from lingering on files that no longer exist. */
async function closeTabsForPath(targetPath: string): Promise<void> {
  const tabs = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => {
      const input = tab.input;
      if (!(input instanceof vscode.TabInputText)) return false;
      const filePath = input.uri.fsPath;
      return filePath === targetPath || filePath.startsWith(`${targetPath}${path.sep}`);
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
