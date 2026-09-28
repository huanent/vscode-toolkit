import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import type { ArchiveTreeEntry } from './protocol';
import { readArchiveTree, validateArchiveUri } from './service';

export const archiveEditorViewType = 'toolkit.archiveEditor';
export const collapseAllArchiveCommand = 'toolkit.archive.collapseAll';

export function registerArchiveEditor(context: vscode.ExtensionContext): vscode.Disposable {
  const panels = new Map<string, vscode.WebviewPanel>();
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
    load: readArchiveTree,
    onPanelResolved: (uri, panel) => {
      const key = uri.toString();
      panels.set(key, panel);
      return {
        dispose: () => {
          if (panels.get(key) === panel) panels.delete(key);
        },
      };
    },
  });
}
