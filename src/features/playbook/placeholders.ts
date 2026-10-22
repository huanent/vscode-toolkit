import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

const placeholderPattern = /\$\{(workspaceFolderBasename|workspaceFolder|userHome|pathSeparator|env:[^}]+)\}/g;

export function resolvePlaybookPlaceholders(value: string, environment: NodeJS.ProcessEnv = process.env): string {
  return value.replace(placeholderPattern, (_match, name: string) => resolvePlaceholder(name, environment));
}

function resolvePlaceholder(name: string, environment: NodeJS.ProcessEnv): string {
  if (name === 'userHome') return os.homedir();
  if (name === 'pathSeparator') return path.sep;
  if (name.startsWith('env:')) return environment[name.slice('env:'.length)] ?? '';

  const folderPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folderPath) throw new Error(`Open a workspace folder to use \${${name}}.`);
  return name === 'workspaceFolder' ? folderPath : path.basename(folderPath);
}
