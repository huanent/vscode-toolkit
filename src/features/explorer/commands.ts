import * as vscode from 'vscode';
import { serveWebviewData } from '@/host/webview-bridge';
import { getWebviewHtml } from '@/host/webview-html';
import type { WebviewLoadedMessage } from '@/shared/webview-protocol';
import type { ExplorerEntry, ExplorerWebviewMessage } from './protocol';
import { listWorkspaceEntries, openWorkspaceFile } from './service';

export function registerExplorerCommands(context: vscode.ExtensionContext): void {
  let panel: vscode.WebviewPanel | undefined;

  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.explorer.open', () => {
      if (panel) {
        panel.reveal();
        return;
      }

      panel = vscode.window.createWebviewPanel('toolkit.explorer', 'Explorer', vscode.ViewColumn.One, {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
        retainContextWhenHidden: true,
      });
      panel.iconPath = new vscode.ThemeIcon('folder-opened');

      const bridge = serveWebviewData<ExplorerEntry[]>(panel.webview, () => listWorkspaceEntries());

      const messageListener = panel.webview.onDidReceiveMessage(async (message: ExplorerWebviewMessage) => {
        if (message.type !== 'openFile') return;
        try {
          await openWorkspaceFile(message.uri);
        } catch (error) {
          await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
        }
      });

      panel.onDidDispose(() => {
        bridge.dispose();
        messageListener.dispose();
        panel = undefined;
      });

      panel.webview.html = getWebviewHtml(panel.webview, vscode.Uri.joinPath(context.extensionUri, 'dist'), {
        page: 'explorer',
        title: 'Explorer',
      });
    }),
    vscode.commands.registerCommand('toolkit.explorer.refresh', async () => {
      const target = panel;
      if (!target) return;
      try {
        const data = await listWorkspaceEntries();
        await target.webview.postMessage({ type: 'loaded', data } satisfies WebviewLoadedMessage<ExplorerEntry[]>);
      } catch (error) {
        await vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
  );
}
