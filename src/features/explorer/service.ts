import { homedir } from 'node:os';
import { posix } from 'node:path';
import * as vscode from 'vscode';
import type { ExplorerDirectory, ExplorerEntry } from './protocol';

export async function listDirectory(location: string | null): Promise<ExplorerDirectory> {
  const uri = location === null ? vscode.Uri.file(homedir()) : vscode.Uri.parse(location);
  const children = await vscode.workspace.fs.readDirectory(uri);
  const entries = children
    .filter(([name]) => name !== '.DS_Store')
    .map(([name, type]): ExplorerEntry => {
      const childUri = vscode.Uri.joinPath(uri, name).toString();
      return { id: childUri, uri: childUri, name, type: type & vscode.FileType.Directory ? 'directory' : 'file' };
    });
  let nextEntry = 0;
  await Promise.all(
    Array.from({ length: Math.min(entries.length, 32) }, async () => {
      while (nextEntry < entries.length) {
        const entry = entries[nextEntry++];
        await addStats(entry);
      }
    }),
  );
  const root = getSystemRoot(uri);
  const ancestors = [directoryEntry(root, '/')];
  let ancestorUri = root;
  for (const name of posix.relative(root.path, uri.path).split('/').filter(Boolean)) {
    ancestorUri = vscode.Uri.joinPath(ancestorUri, name);
    ancestors.push(directoryEntry(ancestorUri, name));
  }
  return { location: uri.toString(), ancestors, entries, canGoBack: false, hasWorkspace: true };
}

async function addStats(entry: ExplorerEntry): Promise<void> {
  try {
    const stat = await vscode.workspace.fs.stat(vscode.Uri.parse(entry.uri));
    entry.type = stat.type & vscode.FileType.Directory ? 'directory' : 'file';
    entry.createdAt = stat.ctime;
    entry.modifiedAt = stat.mtime;
    if (entry.type === 'file') entry.size = stat.size;
  } catch {
    // The entry may be removed between listing and stat.
  }
}

export async function openExplorerFile(value: string): Promise<void> {
  const uri = vscode.Uri.parse(value);
  await vscode.commands.executeCommand('vscode.open', uri);
}

export async function transferEntries(
  values: readonly string[],
  destinationValue: string,
  move: boolean,
): Promise<void> {
  const destination = vscode.Uri.parse(destinationValue);
  const destinationStat = await vscode.workspace.fs.stat(destination);
  if (!(destinationStat.type & vscode.FileType.Directory)) throw new Error('The paste destination is not a folder.');

  for (const value of values) {
    const source = vscode.Uri.parse(value);
    const sourceStat = await vscode.workspace.fs.stat(source);
    const name = posix.basename(source.path);
    if (!name || name === '.' || name === '/') throw new Error(`Cannot transfer "${source.toString()}".`);
    if (
      source.scheme === destination.scheme &&
      source.authority === destination.authority &&
      sourceStat.type & vscode.FileType.Directory
    ) {
      const relative = posix.relative(source.path, destination.path);
      if (relative === '' || (relative !== '..' && !relative.startsWith('../') && !posix.isAbsolute(relative)))
        throw new Error(`Cannot paste a folder into itself: "${source.toString()}".`);
    }

    const target = vscode.Uri.joinPath(destination, name);
    if (source.toString() === target.toString()) {
      if (move) continue;
      const extension = sourceStat.type & vscode.FileType.Directory ? '' : posix.extname(name);
      const stem = name.slice(0, name.length - extension.length);
      for (let suffix = 1; ; suffix++) {
        const copyTarget = vscode.Uri.joinPath(destination, `${stem} ${suffix}${extension}`);
        try {
          await vscode.workspace.fs.copy(source, copyTarget, { overwrite: false });
          break;
        } catch (error) {
          if (!(error instanceof vscode.FileSystemError) || error.code !== 'FileExists') throw error;
        }
      }
      continue;
    }
    try {
      await vscode.workspace.fs.stat(target);
      throw new vscode.FileSystemError(`A file or folder named "${name}" already exists.`);
    } catch (error) {
      if (!(error instanceof vscode.FileSystemError) || error.code !== 'FileNotFound') throw error;
    }

    if (move) await vscode.workspace.fs.rename(source, target, { overwrite: false });
    else await vscode.workspace.fs.copy(source, target, { overwrite: false });
  }
}

export type ExplorerClipboard = { uris: string[]; move: boolean };
export type ExplorerClipboardState = { value?: ExplorerClipboard };

export async function pasteEntries(
  clipboard: ExplorerClipboardState,
  destination: string,
  refresh: () => Promise<void>,
): Promise<void> {
  const pending = clipboard.value;
  if (!pending?.uris.length) return;
  try {
    for (const uri of pending.uris) {
      await transferEntries([uri], destination, pending.move);
      if (pending.move) clipboard.value = { ...pending, uris: pending.uris.filter((pendingUri) => pendingUri !== uri) };
    }
    if (pending.move) clipboard.value = undefined;
  } finally {
    await refresh();
  }
}

function directoryEntry(uri: vscode.Uri, name: string): ExplorerEntry {
  return { id: uri.toString(), name, type: 'directory', uri: uri.toString() };
}

function getSystemRoot(uri = vscode.workspace.workspaceFolders?.[0]?.uri ?? vscode.Uri.file('/')): vscode.Uri {
  const drive = uri.path.match(/^\/[a-zA-Z]:\//)?.[0];
  return uri.with({ path: drive ?? '/', query: '', fragment: '' });
}

export function resolveDirectoryAddress(address: string, location: string | null): string {
  const current = location === null ? getSystemRoot() : vscode.Uri.parse(location);
  const path = address.trim().replace(/\\/g, '/');
  if (!path) return getSystemRoot(current).toString();
  if (/^[a-zA-Z]:\//.test(path)) return current.with({ path: `/${path}` }).toString();
  if (!posix.isAbsolute(path)) throw new Error('Enter an absolute directory path.');
  return current.with({ path: posix.normalize(path), query: '', fragment: '' }).toString();
}
