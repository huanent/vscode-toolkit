import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import { resolveStorageDirectory } from '@/lib/storage';
import type { OpenTempFileRequest, TempFilesWebviewMessage } from './protocol';
import { getTempFilePath, readTempTree } from './service';

let activeWebview: vscode.Webview | undefined;

export function createTempFilesHandler(context: vscode.ExtensionContext): WebviewViewHandler {
  const getTempDirectory = () => {
    return resolveStorageDirectory(context, 'temp');
  };

  return {
    load: () => readTempTree(getTempDirectory()),
    onResolve: (webview) => {
      activeWebview = webview;
    },
    onMessage: async (message, webview) => {
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
      activeWebview = undefined;
    },
  };
}

/** Pushes the current temp tree to the visible dashboard webview, if it is open. */
export async function refreshTempFiles(context: vscode.ExtensionContext): Promise<void> {
  if (!activeWebview) return;
  const entries = await readTempTree(resolveStorageDirectory(context, 'temp'));
  await activeWebview.postMessage({ type: 'tempFilesUpdated', entries } satisfies TempFilesWebviewMessage);
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
