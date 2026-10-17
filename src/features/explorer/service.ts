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
  await Promise.all(entries.map(addStats));
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
