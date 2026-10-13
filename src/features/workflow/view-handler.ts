import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import { resolveStorageRoots } from '@/host/utils/storage';
import type {
  WorkflowDefinition,
  WorkflowEditorOpenRequest,
  WorkflowFilesWebviewMessage,
  WorkflowRunRequest,
} from './protocol';
import { createWorkflowRecord, readWorkflowRecord, readWorkflowRecords } from './service';

export type WorkflowRunner = (name: string, workflow: WorkflowDefinition) => Promise<void>;

export interface WorkflowFilesView extends vscode.Disposable {
  handler: WebviewViewHandler;
  refresh(): Promise<void>;
  setEditorOpener(opener: (id: string, name: string, parentId?: string) => Promise<void>): void;
  setRunner(runner: WorkflowRunner): void;
  openEditor(id?: string, parentId?: string): Promise<void>;
}

export function createWorkflowFilesView(context: vscode.ExtensionContext): WorkflowFilesView {
  let activeWebview: vscode.Webview | undefined;
  let disposed = false;
  let editorOpener: ((id: string, name: string, parentId?: string) => Promise<void>) | undefined;
  let runner: WorkflowRunner | undefined;
  const getWorkflowRoots = () => resolveStorageRoots(context, 'workflows');
  const refresh = async () => {
    const webview = activeWebview;
    if (!webview || disposed) return;
    const entries = await readWorkflowRecords(getWorkflowRoots());
    if (disposed || activeWebview !== webview) return;
    await webview.postMessage({ type: 'workflowFilesUpdated', entries } satisfies WorkflowFilesWebviewMessage);
  };
  const openEditor = async (requestedId?: string, parentId?: string) => {
    if (disposed) return;
    const record = requestedId
      ? await readWorkflowRecord(getWorkflowRoots(), requestedId)
      : createWorkflowRecord(parentId);
    if (requestedId && !record) throw new Error('Workflow no longer exists.');
    if (!record) throw new Error('Could not create workflow.');
    if (!editorOpener) throw new Error('Workflow editor is not available.');
    await editorOpener(record.id, record.name, record.parentId);
  };
  const runFile = async (id: string) => {
    const record = await readWorkflowRecord(getWorkflowRoots(), id);
    if (!record) throw new Error('Workflow no longer exists.');
    if (!runner) throw new Error('Workflow runner is not available.');
    await runner(record.name, record.workflow);
  };

  const handler: WebviewViewHandler = {
    load: () => readWorkflowRecords(getWorkflowRoots()),
    onResolve: (webview) => {
      if (!disposed) activeWebview = webview;
    },
    onMessage: async (message, webview) => {
      try {
        if (isWorkflowEditorOpenRequest(message)) await openEditor(message.id, message.parentId);
        else if (isWorkflowRunRequest(message)) await runFile(message.id);
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
    setEditorOpener: (opener) => {
      editorOpener = opener;
    },
    setRunner: (value) => {
      runner = value;
    },
    openEditor,
    refresh,
    dispose: () => {
      disposed = true;
      activeWebview = undefined;
    },
  };
}

function isWorkflowRunRequest(message: unknown): message is WorkflowRunRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'runWorkflowFile' &&
    'id' in message &&
    typeof message.id === 'string'
  );
}

function isWorkflowEditorOpenRequest(message: unknown): message is WorkflowEditorOpenRequest {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('type' in message) ||
    message.type !== 'openWorkflowEditor'
  ) {
    return false;
  }
  return (
    (!('id' in message) || message.id === undefined || typeof message.id === 'string') &&
    (!('parentId' in message) || message.parentId === undefined || typeof message.parentId === 'string')
  );
}

async function postWorkflowFileError(webview: vscode.Webview, error: unknown): Promise<void> {
  await webview.postMessage({
    type: 'workflowFileError',
    message: error instanceof Error ? error.message : String(error),
  } satisfies WorkflowFilesWebviewMessage);
}
