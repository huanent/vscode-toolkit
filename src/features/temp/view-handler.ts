import * as vscode from 'vscode';
import { watch, type FSWatcher } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import { resolveStorageRoots } from '@/host/utils/storage';
import { findStorageRoot, isStorageScope } from '@/shared/storage-scope';
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
  let watchers: FSWatcher[] = [];
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let watcherGeneration = 0;
  const getRoots = () => resolveStorageRoots(context, 'temp');
  const loadGroups = () => Promise.all(getRoots().map(async ({ scope, directory }) => ({
    scope, entries: (await readTempTree(directory)).filter((entry) => scope !== 'workspace' || entry.name !== '.gitignore'),
  }))); 

  const refresh = async () => {
    const webview = activeWebview;
    if (!webview || disposed) return;
    const entries = await loadGroups();
    if (disposed || activeWebview !== webview) return;
    await webview.postMessage({ type: 'tempFilesUpdated', entries } satisfies TempFilesWebviewMessage);
  };
  const resetWatchers = async () => {
    const generation = ++watcherGeneration;
    for (const watcher of watchers) watcher.close();
    watchers = [];
    for (const { directory } of getRoots()) {
      await mkdir(directory, { recursive: true });
      if (disposed || generation !== watcherGeneration) return;
      try {
        const watcher = watch(directory, { recursive: true }, () => {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => { void refresh().catch(console.error); }, 100);
        });
        watcher.on('error', () => watcher.close());
        watchers.push(watcher);
      } catch (error) {
        console.error('Unable to watch temporary files:', error);
      }
    }
  };
  const workspaceListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    void resetWatchers().then(refresh).catch(console.error);
  });
  const configurationListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('toolkit.storagePath')) void resetWatchers().then(refresh).catch(console.error);
  });
  void resetWatchers().catch(console.error);

  const handler: WebviewViewHandler = {
    load: loadGroups,
    onResolve: (webview) => {
      if (!disposed) activeWebview = webview;
    },
    onMessage: async (message, webview) => {
      if (
        typeof message === 'object' && message !== null &&
        'type' in message && message.type === 'tempFileCommand' &&
        'command' in message && typeof message.command === 'string' &&
        ['copy', 'cut', 'paste', 'delete', 'rename', 'copyPath'].includes(message.command)
      ) {
        await vscode.commands.executeCommand(`toolkit.temp.${message.command}`, message);
        return;
      }
      if (!isOpenTempFileRequest(message)) return;
      try {
        const scope = message.scope ?? 'global';
        await getTempFilePath(findStorageRoot(getRoots(), scope).directory, message.path);
        await vscode.commands.executeCommand('vscode.open', createTempFileUri(message.path, scope), {
          preserveFocus: true,
        } satisfies vscode.TextDocumentShowOptions);
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
    refresh,
    dispose: () => {
      disposed = true;
      watcherGeneration++;
      for (const watcher of watchers) watcher.close();
      if (refreshTimer) clearTimeout(refreshTimer);
      workspaceListener.dispose();
      configurationListener.dispose();
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
    typeof message.path === 'string' &&
    (!('scope' in message) || message.scope === undefined || isStorageScope(message.scope))
  );
}

async function postTempFileError(webview: vscode.Webview, error: unknown): Promise<void> {
  await webview.postMessage({
    type: 'tempFileError',
    message: error instanceof Error ? error.message : String(error),
  } satisfies TempFilesWebviewMessage);
}
