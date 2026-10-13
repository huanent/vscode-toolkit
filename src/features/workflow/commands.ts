import * as vscode from 'vscode';
import { resolveStorageRoots } from '@/host/utils/storage';
import { workflowEditorViewType } from './editor';
import { showFolderPicker } from '@/host/utils/folder-picker';
import {
  deleteWorkflowEntry,
  moveWorkflowEntry,
  readWorkflowRecords,
  renameWorkflowEntry,
  saveWorkflowFolder,
} from './service';

/**
 * Registers the workflow commands. They are invoked from the native
 * `webview/context` menu of the dashboard workflow panel, which passes the
 * right-clicked entry as the command argument.
 */
export function registerWorkflowCommands(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  openEditor: (id?: string, parentId?: string) => Promise<void>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.workflow.createFile', (target: unknown) =>
      openEditor(undefined, parseWorkflowParentId(target)).catch(showWorkflowCommandError),
    ),
    vscode.commands.registerCommand('toolkit.workflow.createFolder', (target: unknown) =>
      createWorkflowFolder(context, refresh, target).catch(showWorkflowCommandError),
    ),
    vscode.commands.registerCommand('toolkit.workflow.edit', (target: unknown) =>
      openEditor(parseWorkflowId(target)).catch(showWorkflowCommandError),
    ),
    vscode.commands.registerCommand('toolkit.workflow.rename', (target: unknown) =>
      renameWorkflow(context, refresh, target).catch(showWorkflowCommandError),
    ),
    vscode.commands.registerCommand('toolkit.workflow.delete', (target: unknown) =>
      deleteWorkflow(context, refresh, target).catch(showWorkflowCommandError),
    ),
    vscode.commands.registerCommand('toolkit.workflow.move', (target: unknown) =>
      moveWorkflow(context, refresh, target).catch(showWorkflowCommandError),
    ),
  );
}

async function moveWorkflow(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
): Promise<void> {
  const id = parseWorkflowEntryId(target);
  if (!id) return;
  const roots = resolveStorageRoots(context, 'workflows');
  const entries = await readWorkflowRecords(roots);
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('Workflow entry no longer exists.');
  const folders = entries
    .filter(
      (candidate) =>
        candidate.type === 'folder' &&
        (entry.type !== 'folder' || (candidate.id !== id && !candidate.id.startsWith(`${id}/`))),
    )
    .map((folder) => folder.id);
  const selected = await showFolderPicker(folders);
  if (!selected) return;

  await moveWorkflowEntry(roots, id, selected.folderPath);
  await refresh();
}

async function deleteWorkflow(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
): Promise<void> {
  const id = parseWorkflowEntryId(target);
  if (!id) return;
  const isFolder = hasFolderId(target);
  const confirmation = await vscode.window.showWarningMessage(
    isFolder
      ? `Delete folder "${getWorkflowName(target)}" and all its contents?`
      : `Delete workflow "${getWorkflowName(target)}"?`,
    { modal: true },
    'Delete',
  );
  if (confirmation !== 'Delete') return;

  const deletedIds = await deleteWorkflowEntry(resolveStorageRoots(context, 'workflows'), id);
  for (const deletedId of deletedIds) await closeWorkflowTabs(deletedId);
  await refresh();
}

async function renameWorkflow(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
): Promise<void> {
  const id = parseWorkflowEntryId(target);
  if (!id) return;
  const isFolder = hasFolderId(target);
  const currentName = getWorkflowName(target);
  const name = await vscode.window.showInputBox({
    prompt: isFolder ? 'Rename folder' : 'Rename workflow',
    value: currentName,
    valueSelection: [0, currentName.length],
    validateInput: validateWorkflowName,
  });
  if (name === undefined) return;

  await renameWorkflowEntry(resolveStorageRoots(context, 'workflows'), id, name);
  await refresh();
}

async function createWorkflowFolder(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
): Promise<void> {
  const name = await vscode.window.showInputBox({ prompt: 'Folder name', validateInput: validateFolderName });
  if (name === undefined) return;
  await saveWorkflowFolder(resolveStorageRoots(context, 'workflows'), name, parseWorkflowParentId(target));
  await refresh();
}

async function closeWorkflowTabs(id: string): Promise<void> {
  const tabs = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => {
      const input = tab.input;
      return (
        input instanceof vscode.TabInputCustom &&
        input.viewType === workflowEditorViewType &&
        input.uri.path.split('/').includes(id)
      );
    });
  if (tabs.length) await vscode.window.tabGroups.close(tabs);
}

function parseWorkflowEntryId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const target = value as Record<string, unknown>;
  const id = target.workflowId ?? target.workflowFolderId;
  return typeof id === 'string' ? id : undefined;
}

function parseWorkflowId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const id = (value as Record<string, unknown>).workflowId;
  return typeof id === 'string' ? id : undefined;
}

function parseFolderId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const id = (value as Record<string, unknown>).workflowFolderId;
  return typeof id === 'string' ? id : undefined;
}

function parseWorkflowParentId(value: unknown): string | undefined {
  const folderId = parseFolderId(value);
  if (folderId) return folderId;
  if (typeof value !== 'object' || value === null) return undefined;
  const parentId = (value as Record<string, unknown>).workflowParentId;
  return typeof parentId === 'string' ? parentId : undefined;
}

function hasFolderId(value: unknown): boolean {
  return parseFolderId(value) !== undefined;
}

function getWorkflowName(value: unknown): string {
  if (typeof value !== 'object' || value === null) return '';
  const name = (value as Record<string, unknown>).workflowName;
  return typeof name === 'string' ? name : '';
}

function validateWorkflowName(value: string): string | undefined {
  if (!value.trim() || /[\\/\0]/.test(value)) return 'Enter a valid workflow name.';
  return undefined;
}

function validateFolderName(value: string): string | undefined {
  if (!value.trim() || /[\\/\0]/.test(value)) return 'Enter a valid folder name.';
  return undefined;
}

function showWorkflowCommandError(error: unknown): void {
  void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
}
