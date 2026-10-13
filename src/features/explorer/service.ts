import { posix } from 'node:path';
import * as vscode from 'vscode';
import type { ExplorerEntry } from './protocol';

/** Lists workspace folders as trees with file stats. Files follow `files.exclude`; empty directories are not listed. */
export async function listWorkspaceEntries(): Promise<ExplorerEntry[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const entries = await Promise.all(
    folders.map(async (folder, index) => {
      const files = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*'));
      return buildFolderEntry(folder, String(index), files);
    }),
  );
  await Promise.all(collectEntries(entries).map(addStats));
  return entries;
}

function collectEntries(entries: readonly ExplorerEntry[]): ExplorerEntry[] {
  return entries.flatMap((entry) => [entry, ...collectEntries(entry.children ?? [])]);
}

async function addStats(entry: ExplorerEntry): Promise<void> {
  try {
    const stat = await vscode.workspace.fs.stat(vscode.Uri.parse(entry.uri));
    entry.createdAt = stat.ctime;
    entry.modifiedAt = stat.mtime;
    if (entry.type === 'file') entry.size = stat.size;
  } catch {
    // The entry may be removed between listing and stat.
  }
}

export async function openWorkspaceFile(value: string): Promise<void> {
  const uri = vscode.Uri.parse(value);
  if (!vscode.workspace.getWorkspaceFolder(uri)) {
    throw new Error('The file is outside the current workspace.');
  }
  await vscode.commands.executeCommand('vscode.open', uri);
}

function buildFolderEntry(folder: vscode.WorkspaceFolder, id: string, files: readonly vscode.Uri[]): ExplorerEntry {
  const root: ExplorerEntry = {
    id,
    name: folder.name,
    type: 'directory',
    uri: folder.uri.toString(),
    children: [],
  };
  const entries = new Map<string, ExplorerEntry>([[id, root]]);

  for (const file of files) {
    const segments = posix.relative(folder.uri.path, file.path).split('/');
    let parent = root;
    for (const [index, segment] of segments.entries()) {
      const isFile = index === segments.length - 1;
      const entryId = `${parent.id}/${segment}`;
      let entry = entries.get(entryId);
      if (!entry) {
        entry = {
          id: entryId,
          name: segment,
          type: isFile ? 'file' : 'directory',
          uri: (isFile ? file : vscode.Uri.joinPath(folder.uri, ...segments.slice(0, index + 1))).toString(),
          children: isFile ? undefined : [],
        };
        parent.children?.push(entry);
        entries.set(entryId, entry);
      }
      parent = entry;
    }
  }

  return root;
}
