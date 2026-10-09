import * as vscode from 'vscode';
import * as path from 'node:path';
import { resolveStorageDirectory } from '@/host/utils/storage';
import type { WorkflowContextTarget, WorkflowEntryType } from './protocol';
import { createWorkflowAutoSaveScheduler } from './auto-save';
import { createWorkflowFileUri, registerWorkflowFileSystem } from './file-system';
import {
  createWorkflowDirectory,
  createWorkflowFile,
  resolveWorkflowDirectory,
  validateWorkflowFileName,
  validateWorkflowFolderName,
} from './service';

/**
 * Registers the workflow commands. They are invoked from the native
 * `webview/context` menu of the dashboard workflow panel, which passes the
 * right-clicked entry as the command argument.
 */
export function registerWorkflowCommands(context: vscode.ExtensionContext, refresh: () => Promise<void>): void {
  const autoSaveScheduler = createWorkflowAutoSaveScheduler();
  context.subscriptions.push(
    registerWorkflowFileSystem(context),
    vscode.workspace.onDidChangeTextDocument(({ document }) => autoSaveScheduler.schedule(document)),
    vscode.workspace.onDidSaveTextDocument(autoSaveScheduler.cancel),
    vscode.workspace.onDidCloseTextDocument(autoSaveScheduler.cancel),
    { dispose: () => autoSaveScheduler.dispose() },
    vscode.commands.registerCommand('toolkit.workflow.createFile', (target: unknown) =>
      createWorkflowEntry(context, refresh, 'file', target).catch(showWorkflowCommandError),
    ),
    vscode.commands.registerCommand('toolkit.workflow.createFolder', (target: unknown) =>
      createWorkflowEntry(context, refresh, 'directory', target).catch(showWorkflowCommandError),
    ),
    vscode.commands.registerCommand('toolkit.workflow.rename', (target: unknown) =>
      renameWorkflowEntryFromInput(refresh, target).catch(showWorkflowCommandError),
    ),
    vscode.commands.registerCommand('toolkit.workflow.delete', (target: unknown) =>
      deleteWorkflowEntryFromInput(refresh, target).catch(showWorkflowCommandError),
    ),
  );
}

async function createWorkflowEntry(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  type: WorkflowEntryType,
  target: unknown,
): Promise<void> {
  const isFile = type === 'file';
  const directory = await resolveTargetDirectory(context, parseWorkflowTarget(target));
  const name = await vscode.window.showInputBox({
    prompt: isFile ? 'Name the workflow file' : 'Name the workflow folder',
    placeHolder: isFile ? 'scratch.md' : 'drafts',
    validateInput: isFile ? validateWorkflowFileName : validateWorkflowFolderName,
  });
  if (name === undefined) return;

  if (isFile) {
    const filePath = await createWorkflowFile(directory, name);
    await refresh();
    const relativePath = path.relative(resolveStorageDirectory(context, 'workflows'), filePath);
    const document = await vscode.workspace.openTextDocument(createWorkflowFileUri(relativePath));
    await vscode.window.showTextDocument(document);
    return;
  }

  await createWorkflowDirectory(directory, name);
  await refresh();
}

/** New entries go into the right-clicked folder, or next to the right-clicked file. */
async function resolveTargetDirectory(context: vscode.ExtensionContext, target: WorkflowContextTarget): Promise<string> {
  const directory = resolveStorageDirectory(context, 'workflows');
  const relativePath = getTargetRelativePath(target);
  if (!relativePath) return directory;
  return resolveWorkflowDirectory(directory, relativePath);
}

async function renameWorkflowEntryFromInput(refresh: () => Promise<void>, target: unknown): Promise<void> {
  const entry = parseWorkflowTarget(target);
  if (!entry.workflowEntryPath) return;

  const isFolder = entry.workflowEntryType === 'directory';
  const currentName = getEntryName(entry.workflowEntryPath);
  const name = await vscode.window.showInputBox({
    prompt: isFolder ? 'Rename the workflow folder' : 'Rename the workflow file',
    value: currentName,
    valueSelection: getRenameSelection(currentName, isFolder),
    validateInput: isFolder ? validateWorkflowFolderName : validateWorkflowFileName,
  });
  if (name === undefined) return;

  const parentPath = path.posix.dirname(entry.workflowEntryPath);
  const renamedPath = path.posix.join(parentPath, name.trim());
  await vscode.workspace.fs.rename(createWorkflowFileUri(entry.workflowEntryPath), createWorkflowFileUri(renamedPath));
  await refresh();
}

async function deleteWorkflowEntryFromInput(refresh: () => Promise<void>, target: unknown): Promise<void> {
  const entry = parseWorkflowTarget(target);
  if (!entry.workflowEntryPath) return;

  const isFolder = entry.workflowEntryType === 'directory';
  const label = isFolder ? 'folder' : 'file';
  const confirmation = await vscode.window.showWarningMessage(
    `Delete workflow ${label} "${getEntryName(entry.workflowEntryPath)}"?`,
    { modal: true, detail: isFolder ? 'The folder and everything inside it is removed from disk.' : undefined },
    'Delete',
  );
  if (confirmation !== 'Delete') return;

  await vscode.workspace.fs.delete(createWorkflowFileUri(entry.workflowEntryPath), { recursive: isFolder });
  await closeTabsForPath(entry.workflowEntryPath);
  await refresh();
}

/** Keeps editors from lingering on files that no longer exist. */
async function closeTabsForPath(relativePath: string): Promise<void> {
  const targetUri = createWorkflowFileUri(relativePath);
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

function getTargetRelativePath(target: WorkflowContextTarget): string | undefined {
  if (!target.workflowEntryPath) return undefined;
  if (target.workflowEntryType !== 'file') return target.workflowEntryPath;

  const separatorIndex = target.workflowEntryPath.lastIndexOf('/');
  return separatorIndex === -1 ? undefined : target.workflowEntryPath.slice(0, separatorIndex);
}

function getEntryName(relativePath: string): string {
  return relativePath.slice(relativePath.lastIndexOf('/') + 1);
}

/** Selects the file name without its extension, and the whole name for folders. */
function getRenameSelection(name: string, isFolder: boolean): [number, number] {
  const extensionIndex = isFolder ? -1 : name.lastIndexOf('.');
  return [0, extensionIndex > 0 ? extensionIndex : name.length];
}

function parseWorkflowTarget(value: unknown): WorkflowContextTarget {
  if (typeof value !== 'object' || value === null) return {};
  const target = value as Record<string, unknown>;
  return {
    workflowEntryPath: typeof target.workflowEntryPath === 'string' ? target.workflowEntryPath : undefined,
    workflowEntryType:
      target.workflowEntryType === 'file' || target.workflowEntryType === 'directory' ? target.workflowEntryType : undefined,
  };
}

function showWorkflowCommandError(error: unknown): void {
  void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
}
