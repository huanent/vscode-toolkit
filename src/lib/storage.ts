import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

export function resolveStorageDirectory(context: vscode.ExtensionContext, directoryName: string): string {
  const storagePath = vscode.workspace.getConfiguration('toolkit').get<string>('storagePath', '');
  const configuredPath = storagePath.trim();
  const rootPath = expandHome(configuredPath || context.globalStorageUri.fsPath, os.homedir());
  return path.join(path.resolve(rootPath), directoryName);
}

function expandHome(value: string, homeDirectory: string): string {
  if (value === '~') return homeDirectory;
  if (value.startsWith('~/') || value.startsWith('~\\')) return path.join(homeDirectory, value.slice(2));
  return value;
}
