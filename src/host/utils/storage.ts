import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { StorageRoot } from '@/shared/storage-scope';

export function resolveStorageDirectory(context: vscode.ExtensionContext, directoryName: string): string {
  const storagePath = vscode.workspace.getConfiguration('toolkit').get<string>('storagePath', '');
  const configuredPath = storagePath.trim();
  const rootPath = expandHome(configuredPath || context.globalStorageUri.fsPath, os.homedir());
  return path.join(path.resolve(rootPath), directoryName);
}

export function isWorkspaceStorageAvailable(): boolean {
  return vscode.workspace.workspaceFolders?.[0] !== undefined;
}

export function resolveStorageRoots(context: vscode.ExtensionContext, directoryName: string): StorageRoot[] {
  const roots: StorageRoot[] = [{ scope: 'global', directory: resolveStorageDirectory(context, directoryName) }];
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    roots.push({
      scope: 'workspace',
      directory: path.join(workspaceFolder.uri.fsPath, '.toolkit', directoryName),
    });
  }
  return roots;
}

function expandHome(value: string, homeDirectory: string): string {
  if (value === '~') return homeDirectory;
  if (value.startsWith('~/') || value.startsWith('~\\')) return path.join(homeDirectory, value.slice(2));
  return value;
}
