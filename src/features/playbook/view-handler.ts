import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import { resolveStorageRoots } from '@/host/utils/storage';
import type {
  PlaybookDefinition,
  PlaybookEditorOpenRequest,
  PlaybookFilesWebviewMessage,
  PlaybookRunRequest,
} from './protocol';
import { createPlaybookRecord, readPlaybookRecord, readPlaybookRecords } from './service';

export type PlaybookRunner = (name: string, playbook: PlaybookDefinition) => Promise<void>;

export interface PlaybookFilesView extends vscode.Disposable {
  handler: WebviewViewHandler;
  refresh(): Promise<void>;
  setEditorOpener(opener: (id: string, name: string, parentId?: string) => Promise<void>): void;
  setRunner(runner: PlaybookRunner): void;
  openEditor(id?: string, parentId?: string): Promise<void>;
}

export function createPlaybookFilesView(context: vscode.ExtensionContext): PlaybookFilesView {
  let activeWebview: vscode.Webview | undefined;
  let disposed = false;
  let editorOpener: ((id: string, name: string, parentId?: string) => Promise<void>) | undefined;
  let runner: PlaybookRunner | undefined;
  const getPlaybookRoots = () => resolveStorageRoots(context, 'playbooks');
  const refresh = async () => {
    const webview = activeWebview;
    if (!webview || disposed) return;
    const entries = await readPlaybookRecords(getPlaybookRoots());
    if (disposed || activeWebview !== webview) return;
    await webview.postMessage({ type: 'playbookFilesUpdated', entries } satisfies PlaybookFilesWebviewMessage);
  };
  const openEditor = async (requestedId?: string, parentId?: string) => {
    if (disposed) return;
    const record = requestedId
      ? await readPlaybookRecord(getPlaybookRoots(), requestedId)
      : createPlaybookRecord(parentId);
    if (requestedId && !record) throw new Error('Playbook no longer exists.');
    if (!record) throw new Error('Could not create playbook.');
    if (!editorOpener) throw new Error('Playbook editor is not available.');
    await editorOpener(record.id, record.name, record.parentId);
  };
  const runFile = async (id: string) => {
    const record = await readPlaybookRecord(getPlaybookRoots(), id);
    if (!record) throw new Error('Playbook no longer exists.');
    if (!runner) throw new Error('Playbook runner is not available.');
    await runner(record.name, record.playbook);
  };

  const handler: WebviewViewHandler = {
    load: () => readPlaybookRecords(getPlaybookRoots()),
    onResolve: (webview) => {
      if (!disposed) activeWebview = webview;
    },
    onMessage: async (message, webview) => {
      try {
        if (isPlaybookEditorOpenRequest(message)) await openEditor(message.id, message.parentId);
        else if (isPlaybookRunRequest(message)) await runFile(message.id);
      } catch (error) {
        await postPlaybookFileError(webview, error);
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

function isPlaybookRunRequest(message: unknown): message is PlaybookRunRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'runPlaybookFile' &&
    'id' in message &&
    typeof message.id === 'string'
  );
}

function isPlaybookEditorOpenRequest(message: unknown): message is PlaybookEditorOpenRequest {
  if (
    typeof message !== 'object' ||
    message === null ||
    !('type' in message) ||
    message.type !== 'openPlaybookEditor'
  ) {
    return false;
  }
  return (
    (!('id' in message) || message.id === undefined || typeof message.id === 'string') &&
    (!('parentId' in message) || message.parentId === undefined || typeof message.parentId === 'string')
  );
}

async function postPlaybookFileError(webview: vscode.Webview, error: unknown): Promise<void> {
  await webview.postMessage({
    type: 'playbookFileError',
    message: error instanceof Error ? error.message : String(error),
  } satisfies PlaybookFilesWebviewMessage);
}
