import * as path from 'node:path';
import * as vscode from 'vscode';
import { resolveStorageDirectory } from '@/host/utils/storage';
import { createTempFileUri } from '@/features/temp/file-system';
import { TEMP_FILE_SYSTEM_SCHEME, type TempContextTarget } from '@/features/temp/protocol';
import { getTempFilePath } from '@/features/temp/service';

const nodeExtensions = new Set(['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts']);

export async function resolveScriptTarget(
  context: vscode.ExtensionContext,
  target: vscode.Uri | TempContextTarget | undefined,
): Promise<vscode.Uri | undefined> {
  if (!target) return undefined;
  if (target instanceof vscode.Uri) {
    return target.scheme === TEMP_FILE_SYSTEM_SCHEME
      ? getRunnableFileUri(context, await vscode.workspace.openTextDocument(target))
      : target;
  }
  if (target.tempEntryType !== 'file' || typeof target.tempEntryPath !== 'string') {
    throw new Error('Select a temporary script file to run.');
  }
  const uri = createTempFileUri(target.tempEntryPath);
  return getRunnableFileUri(context, await vscode.workspace.openTextDocument(uri));
}

export async function resolveNodeDocument(uri: vscode.Uri | undefined): Promise<vscode.TextDocument | undefined> {
  if (uri && isNodeScriptUri(uri)) {
    return vscode.workspace.openTextDocument(uri);
  }

  const activeDocument = vscode.window.activeTextEditor?.document;
  return activeDocument && isNodeScriptDocument(activeDocument) ? activeDocument : undefined;
}

export async function getRunnableFileUri(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument,
): Promise<vscode.Uri> {
  if (document.uri.scheme !== 'untitled') {
    if (document.isDirty && !(await document.save())) {
      throw new Error('Save the script before running it.');
    }
    if (document.uri.scheme === TEMP_FILE_SYSTEM_SCHEME) {
      const filePath = await getTempFilePath(resolveStorageDirectory(context, 'temp'), document.uri.path.slice(1));
      return vscode.Uri.file(filePath);
    }
    return document.uri;
  }

  const extension = document.languageId === 'typescript' ? '.ts' : '.js';
  const tempDirectory = vscode.Uri.joinPath(context.globalStorageUri, 'scripts');
  const tempUri = vscode.Uri.joinPath(tempDirectory, `untitled${extension}`);
  await vscode.workspace.fs.createDirectory(tempDirectory);
  await vscode.workspace.fs.writeFile(tempUri, Buffer.from(document.getText()));
  return tempUri;
}

export function isTypeScriptDocument(document: vscode.TextDocument): boolean {
  return (
    document.languageId === 'typescript' ||
    ['.ts', '.mts', '.cts'].includes(path.extname(document.uri.fsPath).toLowerCase())
  );
}

export function isNodeScriptUri(uri: vscode.Uri): boolean {
  const isFileSystemUri = uri.scheme === 'file' || uri.scheme === 'vscode-remote';
  return uri.scheme === 'untitled' || (isFileSystemUri && nodeExtensions.has(path.extname(uri.fsPath).toLowerCase()));
}

function isNodeScriptDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'javascript' || document.languageId === 'typescript' || isNodeScriptUri(document.uri);
}
