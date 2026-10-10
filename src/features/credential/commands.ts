import * as vscode from 'vscode';
import { CredentialService } from './service';
import { serveWebviewData } from '@/host/webview-bridge';
import { getWebviewHtml } from '@/host/webview-html';
import type { Credential, CredentialHostMessage, CredentialWebviewMessage } from './protocol';

export function registerCredentialCommands(context: vscode.ExtensionContext): void {
  const service = new CredentialService(context);
  let panel: vscode.WebviewPanel | undefined;

  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.credential.manage', () => {
      if (panel) {
        panel.reveal();
        return;
      }

      panel = vscode.window.createWebviewPanel('toolkit.credential', 'Credentials', vscode.ViewColumn.One, {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
        retainContextWhenHidden: true,
      });

      panel.iconPath = new vscode.ThemeIcon('key');

      const bridge = serveWebviewData<Credential[]>(panel.webview, () => service.list());

      const messageListener = panel.webview.onDidReceiveMessage(async (message: CredentialWebviewMessage) => {
        try {
          if (message.type === 'saveCredential') {
            await service.save(message.credential);
            const credentials = await service.list();
            await panel?.webview.postMessage({
              type: 'credentialsUpdated',
              credentials,
            } satisfies CredentialHostMessage);
          } else if (message.type === 'deleteCredential') {
            await service.delete(message.id);
            const credentials = await service.list();
            await panel?.webview.postMessage({
              type: 'credentialsUpdated',
              credentials,
            } satisfies CredentialHostMessage);
          } else if (message.type === 'refreshCredentials') {
            const credentials = await service.list();
            await panel?.webview.postMessage({
              type: 'credentialsUpdated',
              credentials,
            } satisfies CredentialHostMessage);
          }
        } catch (error) {
          await panel?.webview.postMessage({
            type: 'credentialError',
            message: error instanceof Error ? error.message : String(error),
          } satisfies CredentialHostMessage);
        }
      });

      panel.onDidDispose(() => {
        bridge.dispose();
        messageListener.dispose();
        panel = undefined;
      });

      panel.webview.html = getWebviewHtml(panel.webview, vscode.Uri.joinPath(context.extensionUri, 'dist'), {
        page: 'credential',
        title: 'Credentials',
        data: {},
      });
    }),
  );
}
