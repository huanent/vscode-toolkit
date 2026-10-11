import * as vscode from 'vscode';
import { resolveStorageDirectory } from '@/host/utils/storage';
import { workflowEditorViewType } from './editor';
import { deleteWorkflowEntry, renameWorkflowEntry, saveWorkflowFolder } from './service';

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
      openEditor(undefined, parseFolderId(target)).catch(showWorkflowCommandError),
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
  );
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
    isFolder ? 'Delete this folder and all its contents?' : 'Delete this workflow?',
    { modal: true },
    'Delete',
  );
  if (confirmation !== 'Delete') return;

  const deletedIds = await deleteWorkflowEntry(resolveStorageDirectory(context, 'workflows'), id);
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
    prompt: isFolder ? 'Rename workflow folder' : 'Rename workflow',
    value: currentName,
    valueSelection: [0, currentName.length],
    validateInput: validateWorkflowName,
  });
  if (name === undefined) return;

  await renameWorkflowEntry(resolveStorageDirectory(context, 'workflows'), id, name);
  await refresh();
}

async function createWorkflowFolder(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
): Promise<void> {
  const name = await vscode.window.showInputBox({ prompt: 'Folder name', validateInput: validateFolderName });
  if (name === undefined) return;
  await saveWorkflowFolder(resolveStorageDirectory(context, 'workflows'), name, parseFolderId(target));
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
