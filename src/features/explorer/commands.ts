import * as vscode from 'vscode';
import { serveWebviewData } from '@/host/webview-bridge';
import { getWebviewHtml } from '@/host/webview-html';
import type { WebviewLoadedMessage } from '@/shared/webview-protocol';
import type { ExplorerDirectory, ExplorerWebviewMessage } from './protocol';
import { listDirectory, openExplorerFile, resolveDirectoryAddress } from './service';

export function registerExplorerCommands(context: vscode.ExtensionContext): void {
  let panel: vscode.WebviewPanel | undefined;
  let refresh: (() => Promise<void>) | undefined;

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

      const target = panel;
      const folders = vscode.workspace.workspaceFolders ?? [];
      let location: string | null = folders[0]?.uri.toString() ?? null;
      let history: (string | null)[] = [];
      let revision = 0;
      const load = async (next: string | null, mode: 'navigate' | 'back' | 'refresh') => {
        const request = ++revision;
        let data: ExplorerDirectory;
        try {
          data = await listDirectory(next);
        } catch (error) {
          if (request !== revision) return undefined;
          throw error;
        }
        if (request !== revision) return undefined;
        if (mode === 'back') history = history.slice(0, -1);
        else if (mode === 'navigate' && data.location !== location) history.push(location);
        location = data.location;
        return { ...data, canGoBack: history.length > 0 };
      };
      const publish = async (next: string | null, mode: 'navigate' | 'back' | 'refresh') => {
        try {
          const data = await load(next, mode);
          if (data) {
            await target.webview.postMessage({
              type: 'loaded',
              data,
            } satisfies WebviewLoadedMessage<ExplorerDirectory>);
          }
        } catch (error) {
          await target.webview.postMessage({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      };
      refresh = () => publish(location, 'refresh');
      const bridge = serveWebviewData<ExplorerDirectory>(target.webview, async () => {
        const data = await load(location, 'refresh');
        if (!data) throw new Error('Directory loading was superseded.');
        return data;
      });

      const messageListener = panel.webview.onDidReceiveMessage(async (message: ExplorerWebviewMessage) => {
        try {
          if (message.type === 'openFile') await openExplorerFile(message.uri);
          else if (message.type === 'readDirectory') await publish(message.uri, 'navigate');
          else if (message.type === 'navigateAddress')
            await publish(resolveDirectoryAddress(message.address, location), 'navigate');
          else if (message.type === 'setViewMode' && (message.mode === 'list' || message.mode === 'grid'))
            await context.globalState.update('explorer.viewMode', message.mode);
          else if (message.type === 'goBack' && history.length) {
            await publish(history[history.length - 1] ?? null, 'back');
          }
        } catch (error) {
          await target.webview.postMessage({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });

      panel.onDidDispose(() => {
        revision++;
        bridge.dispose();
        messageListener.dispose();
        panel = undefined;
        refresh = undefined;
      });

      panel.webview.html = getWebviewHtml(panel.webview, vscode.Uri.joinPath(context.extensionUri, 'dist'), {
        page: 'explorer',
        title: 'Explorer',
        data: { viewMode: context.globalState.get<string>('explorer.viewMode', 'list') },
      });
    }),
    vscode.commands.registerCommand('toolkit.explorer.refresh', async () => {
      await refresh?.();
    }),
  );
}
