import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import type { ArchiveChildrenResult, ArchiveTreeEntry } from './protocol';
import { readArchiveIndex, validateArchiveUri, type ArchiveIndex } from './service';

export const archiveEditorViewType = 'toolkit.archiveEditor';
export const collapseAllArchiveCommand = 'toolkit.archive.collapseAll';

export function registerArchiveEditor(context: vscode.ExtensionContext): vscode.Disposable {
  const panels = new Map<string, vscode.WebviewPanel>();
  const indexes = new Map<string, Promise<ArchiveIndex>>();
  const readIndex = (uri: vscode.Uri) => {
    const key = uri.toString();
    let index = indexes.get(key);
    if (!index) {
      index = readArchiveIndex(uri).catch((error: unknown) => {
        indexes.delete(key);
        throw error;
      });
      indexes.set(key, index);
    }
    return index;
  };
  const command = vscode.commands.registerCommand(collapseAllArchiveCommand, () => {
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    if (!(input instanceof vscode.TabInputCustom) || input.viewType !== archiveEditorViewType) return;
    void panels.get(input.uri.toString())?.webview.postMessage({ type: 'collapseAll' });
  });
  context.subscriptions.push(command);

  return registerWebviewEditor<ArchiveTreeEntry[]>(context, {
    viewType: archiveEditorViewType,
    page: 'archive',
    icon: 'file-zip',
    validate: validateArchiveUri,
    load: async (uri) => [...((await readIndex(uri)).get('') ?? [])],
    onPanelResolved: (uri, panel) => {
      const key = uri.toString();
      panels.set(key, panel);
      const listener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (
          !message ||
          typeof message !== 'object' ||
          !('type' in message) ||
          message.type !== 'loadArchiveChildren' ||
          !('path' in message) ||
          typeof message.path !== 'string'
        )
          return;
        const result: ArchiveChildrenResult = { type: 'archiveChildren', path: message.path };
        try {
          const entries = (await readIndex(uri)).get(message.path);
          if (!entries) throw new Error('Archive directory no longer exists.');
          result.entries = [...entries];
        } catch (error) {
          result.error = error instanceof Error ? error.message : String(error);
        }
        await panel.webview.postMessage(result);
      });
      return {
        dispose: () => {
          listener.dispose();
          indexes.delete(key);
          if (panels.get(key) === panel) panels.delete(key);
        },
      };
    },
  });
}
