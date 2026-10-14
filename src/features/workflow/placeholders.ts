import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

const placeholderPattern = /\$\{(workspaceFolderBasename|workspaceFolder|userHome|pathSeparator|env:[^}]+)\}/g;

export function resolveWorkflowPlaceholders(value: string): string {
  return value.replace(placeholderPattern, (_match, name: string) => resolvePlaceholder(name));
}

function resolvePlaceholder(name: string): string {
  if (name === 'userHome') return os.homedir();
  if (name === 'pathSeparator') return path.sep;
  if (name.startsWith('env:')) return process.env[name.slice('env:'.length)] ?? '';

  const folderPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folderPath) throw new Error(`Open a workspace folder to use \${${name}}.`);
  return name === 'workspaceFolder' ? folderPath : path.basename(folderPath);
}
