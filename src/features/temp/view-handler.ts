import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import type {
  CreateTempFileRequest,
  OpenTempFileRequest,
  SetTempTabActiveRequest,
  TempFilesWebviewMessage,
} from './protocol';
import { createTempFile, getTempFilePath, readTempTree, resolveTempDirectory, validateTempFileName } from './service';

export function createTempFilesHandler(context: vscode.ExtensionContext): WebviewViewHandler {
  const getTempDirectory = () => {
    const storagePath = vscode.workspace.getConfiguration('toolkit').get<string>('storagePath', '');
    return resolveTempDirectory(storagePath, context.globalStorageUri.fsPath);
  };

  return {
    load: () => readTempTree(getTempDirectory()),
    onMessage: async (message, webview) => {
      if (isSetTempTabActiveRequest(message)) {
        await vscode.commands.executeCommand('setContext', 'toolkit.dashboard.tempActive', message.active);
        return;
      }

      if (isCreateTempFileRequest(message)) {
        const name = await vscode.window.showInputBox({
          prompt: 'Name the temporary file',
          placeHolder: 'scratch.md',
          validateInput: validateTempFileName,
        });
        if (name === undefined) return;

        try {
          await createTempFileAndOpen(context, name);
          const entries = await readTempTree(getTempDirectory());
          await webview.postMessage({ type: 'tempFilesUpdated', entries } satisfies TempFilesWebviewMessage);
        } catch (error) {
          await postTempFileError(webview, error);
        }
        return;
      }

      if (!isOpenTempFileRequest(message)) return;
      try {
        const filePath = await getTempFilePath(getTempDirectory(), message.path);
        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(document);
      } catch (error) {
        await postTempFileError(webview, error);
      }
    },
    onDispose: () => {
      void vscode.commands.executeCommand('setContext', 'toolkit.dashboard.tempActive', false);
    },
  };
}

export async function createTempFileFromInput(context: vscode.ExtensionContext): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Name the temporary file',
    placeHolder: 'scratch.md',
    validateInput: validateTempFileName,
  });
  if (name === undefined) return;
  await createTempFileAndOpen(context, name);
}

async function createTempFileAndOpen(context: vscode.ExtensionContext, name: string): Promise<void> {
  const storagePath = vscode.workspace.getConfiguration('toolkit').get<string>('storagePath', '');
  const directory = resolveTempDirectory(storagePath, context.globalStorageUri.fsPath);
  const filePath = await createTempFile(directory, name);
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(document);
}

function isCreateTempFileRequest(message: unknown): message is CreateTempFileRequest {
  return typeof message === 'object' && message !== null && 'type' in message && message.type === 'createTempFile';
}

function isSetTempTabActiveRequest(message: unknown): message is SetTempTabActiveRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'setTempTabActive' &&
    'active' in message &&
    typeof message.active === 'boolean'
  );
}

function isOpenTempFileRequest(message: unknown): message is OpenTempFileRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'openTempFile' &&
    'path' in message &&
    typeof message.path === 'string'
  );
}

async function postTempFileError(webview: vscode.Webview, error: unknown): Promise<void> {
  await webview.postMessage({
    type: 'tempFileError',
    message: error instanceof Error ? error.message : String(error),
  } satisfies TempFilesWebviewMessage);
}
