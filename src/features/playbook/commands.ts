import * as vscode from 'vscode';
import { resolveStorageRoots } from '@/host/utils/storage';
import { playbookEditorViewType } from './editor';
import { showFolderPicker } from '@/host/utils/folder-picker';
import {
  deletePlaybookEntry,
  movePlaybookEntry,
  readPlaybookRecords,
  renamePlaybookEntry,
  savePlaybookFolder,
} from './service';

/**
 * Registers the playbook commands. They are invoked from the native
 * `webview/context` menu of the dashboard playbook panel, which passes the
 * right-clicked entry as the command argument.
 */
export function registerPlaybookCommands(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  openEditor: (id?: string, parentId?: string) => Promise<void>,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.playbook.createFile', (target: unknown) =>
      openEditor(undefined, parsePlaybookParentId(target)).catch(showPlaybookCommandError),
    ),
    vscode.commands.registerCommand('toolkit.playbook.createFolder', (target: unknown) =>
      createPlaybookFolder(context, refresh, target).catch(showPlaybookCommandError),
    ),
    vscode.commands.registerCommand('toolkit.playbook.edit', (target: unknown) =>
      openEditor(parsePlaybookId(target)).catch(showPlaybookCommandError),
    ),
    vscode.commands.registerCommand('toolkit.playbook.copyAiReference', (target: unknown) =>
      copyPlaybookAiReference(context, target).catch(showPlaybookCommandError),
    ),
    vscode.commands.registerCommand('toolkit.playbook.rename', (target: unknown) =>
      renamePlaybook(context, refresh, target).catch(showPlaybookCommandError),
    ),
    vscode.commands.registerCommand('toolkit.playbook.delete', (target: unknown) =>
      deletePlaybook(context, refresh, target).catch(showPlaybookCommandError),
    ),
    vscode.commands.registerCommand('toolkit.playbook.move', (target: unknown) =>
      movePlaybook(context, refresh, target).catch(showPlaybookCommandError),
    ),
  );
}

async function copyPlaybookAiReference(context: vscode.ExtensionContext, target: unknown): Promise<void> {
  const id = parsePlaybookId(target);
  if (!id) return;
  const entries = await readPlaybookRecords(resolveStorageRoots(context, 'playbooks'));
  const entry = entries.find((candidate) => candidate.type === 'playbook' && candidate.id === id);
  if (!entry) throw new Error('Playbook no longer exists.');
  const shortId = entry.id.slice(0, 8);
  const conflict = entries.some(
    (candidate) => candidate.type === 'playbook' && candidate.id !== entry.id && candidate.id.startsWith(shortId),
  );
  const path = entry.parentId ? `${entry.parentId}/${entry.name}` : entry.name;
  await vscode.env.clipboard.writeText(`[Playbook "${path}", id: ${conflict ? entry.id : shortId}]`);
  void vscode.window.setStatusBarMessage('AI reference copied to clipboard', 2000);
}

async function movePlaybook(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
): Promise<void> {
  const id = parsePlaybookEntryId(target);
  if (!id) return;
  const roots = resolveStorageRoots(context, 'playbooks');
  const entries = await readPlaybookRecords(roots);
  const entry = entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('Playbook entry no longer exists.');
  const folders = entries
    .filter(
      (candidate) =>
        candidate.type === 'folder' &&
        (entry.type !== 'folder' || (candidate.id !== id && !candidate.id.startsWith(`${id}/`))),
    )
    .map((folder) => folder.id);
  const selected = await showFolderPicker(folders);
  if (!selected) return;

  await movePlaybookEntry(roots, id, selected.folderPath);
  await refresh();
}

async function deletePlaybook(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
): Promise<void> {
  const id = parsePlaybookEntryId(target);
  if (!id) return;
  const isFolder = hasFolderId(target);
  const confirmation = await vscode.window.showWarningMessage(
    isFolder
      ? `Delete folder "${getPlaybookName(target)}" and all its contents?`
      : `Delete playbook "${getPlaybookName(target)}"?`,
    { modal: true },
    'Delete',
  );
  if (confirmation !== 'Delete') return;

  const deletedIds = await deletePlaybookEntry(resolveStorageRoots(context, 'playbooks'), id);
  for (const deletedId of deletedIds) await closePlaybookTabs(deletedId);
  await refresh();
}

async function renamePlaybook(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
): Promise<void> {
  const id = parsePlaybookEntryId(target);
  if (!id) return;
  const isFolder = hasFolderId(target);
  const currentName = getPlaybookName(target);
  const name = await vscode.window.showInputBox({
    prompt: isFolder ? 'Rename folder' : 'Rename playbook',
    value: currentName,
    valueSelection: [0, currentName.length],
    validateInput: validatePlaybookName,
  });
  if (name === undefined) return;

  await renamePlaybookEntry(resolveStorageRoots(context, 'playbooks'), id, name);
  await refresh();
}

async function createPlaybookFolder(
  context: vscode.ExtensionContext,
  refresh: () => Promise<void>,
  target: unknown,
): Promise<void> {
  const name = await vscode.window.showInputBox({ prompt: 'Folder name', validateInput: validateFolderName });
  if (name === undefined) return;
  await savePlaybookFolder(resolveStorageRoots(context, 'playbooks'), name, parsePlaybookParentId(target));
  await refresh();
}

async function closePlaybookTabs(id: string): Promise<void> {
  const tabs = vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter((tab) => {
      const input = tab.input;
      return (
        input instanceof vscode.TabInputCustom &&
        input.viewType === playbookEditorViewType &&
        input.uri.path.split('/').includes(id)
      );
    });
  if (tabs.length) await vscode.window.tabGroups.close(tabs);
}

function parsePlaybookEntryId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const target = value as Record<string, unknown>;
  const id = target.playbookId ?? target.playbookFolderId;
  return typeof id === 'string' ? id : undefined;
}

function parsePlaybookId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const id = (value as Record<string, unknown>).playbookId;
  return typeof id === 'string' ? id : undefined;
}

function parseFolderId(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const id = (value as Record<string, unknown>).playbookFolderId;
  return typeof id === 'string' ? id : undefined;
}

function parsePlaybookParentId(value: unknown): string | undefined {
  const folderId = parseFolderId(value);
  if (folderId) return folderId;
  if (typeof value !== 'object' || value === null) return undefined;
  const parentId = (value as Record<string, unknown>).playbookParentId;
  return typeof parentId === 'string' ? parentId : undefined;
}

function hasFolderId(value: unknown): boolean {
  return parseFolderId(value) !== undefined;
}

function getPlaybookName(value: unknown): string {
  if (typeof value !== 'object' || value === null) return '';
  const name = (value as Record<string, unknown>).playbookName;
  return typeof name === 'string' ? name : '';
}

function validatePlaybookName(value: string): string | undefined {
  if (!value.trim() || /[\\/\0]/.test(value)) return 'Enter a valid playbook name.';
  return undefined;
}

function validateFolderName(value: string): string | undefined {
  if (!value.trim() || /[\\/\0]/.test(value)) return 'Enter a valid folder name.';
  return undefined;
}

function showPlaybookCommandError(error: unknown): void {
  void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error), { modal: true });
}
