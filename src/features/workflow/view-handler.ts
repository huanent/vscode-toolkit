import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import { resolveStorageDirectory } from '@/host/utils/storage';
import type { OpenWorkflowFileRequest, WorkflowFilesWebviewMessage } from './protocol';
import { createWorkflowFileUri } from './file-system';
import { getWorkflowFilePath, readWorkflowTree } from './service';

export interface WorkflowFilesView extends vscode.Disposable {
  handler: WebviewViewHandler;
  refresh(): Promise<void>;
}

export function createWorkflowFilesView(context: vscode.ExtensionContext): WorkflowFilesView {
  let activeWebview: vscode.Webview | undefined;
  let disposed = false;
  const getWorkflowDirectory = () => {
    return resolveStorageDirectory(context, 'workflows');
  };

  const handler: WebviewViewHandler = {
    load: () => readWorkflowTree(getWorkflowDirectory()),
    onResolve: (webview) => {
      if (!disposed) activeWebview = webview;
    },
    onMessage: async (message, webview) => {
      if (!isOpenWorkflowFileRequest(message)) return;
      try {
        await getWorkflowFilePath(getWorkflowDirectory(), message.path);
        const document = await vscode.workspace.openTextDocument(createWorkflowFileUri(message.path));
        await vscode.window.showTextDocument(document);
      } catch (error) {
        await postWorkflowFileError(webview, error);
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
      const entries = await readWorkflowTree(getWorkflowDirectory());
      if (disposed || activeWebview !== webview) return;
      await webview.postMessage({ type: 'workflowFilesUpdated', entries } satisfies WorkflowFilesWebviewMessage);
    },
    dispose: () => {
      disposed = true;
      activeWebview = undefined;
    },
  };
}

function isOpenWorkflowFileRequest(message: unknown): message is OpenWorkflowFileRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'openWorkflowFile' &&
    'path' in message &&
    typeof message.path === 'string'
  );
}

async function postWorkflowFileError(webview: vscode.Webview, error: unknown): Promise<void> {
  await webview.postMessage({
    type: 'workflowFileError',
    message: error instanceof Error ? error.message : String(error),
  } satisfies WorkflowFilesWebviewMessage);
}
