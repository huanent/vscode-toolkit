import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import { resolveStorageDirectory } from '@/host/utils/storage';
import type { OpenTempFileRequest, TempFilesWebviewMessage } from './protocol';
import { createTempFileUri } from './file-system';
import { getTempFilePath, readTempTree } from './service';

export interface TempFilesView extends vscode.Disposable {
  handler: WebviewViewHandler;
  refresh(): Promise<void>;
}

export function createTempFilesView(context: vscode.ExtensionContext): TempFilesView {
  let activeWebview: vscode.Webview | undefined;
  let disposed = false;
  const getTempDirectory = () => {
    return resolveStorageDirectory(context, 'temp');
  };

  const handler: WebviewViewHandler = {
    load: () => readTempTree(getTempDirectory()),
    onResolve: (webview) => {
      if (!disposed) activeWebview = webview;
    },
    onMessage: async (message, webview) => {
      if (!isOpenTempFileRequest(message)) return;
      try {
        await getTempFilePath(getTempDirectory(), message.path);
        const document = await vscode.workspace.openTextDocument(createTempFileUri(message.path));
        await vscode.window.showTextDocument(document);
      } catch (error) {
        await postTempFileError(webview, error);
      }
    },
    onDispose: () => {
      activeWebview = undefined;
    },
  };

  return {
    handler,
    refresh: async () => {
      const webview = activeWebview;
      if (!webview || disposed) return;
      const entries = await readTempTree(getTempDirectory());
      if (disposed || activeWebview !== webview) return;
      await webview.postMessage({ type: 'tempFilesUpdated', entries } satisfies TempFilesWebviewMessage);
    },
    dispose: () => {
      disposed = true;
      activeWebview = undefined;
    },
  };
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
