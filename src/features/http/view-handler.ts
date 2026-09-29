import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import type { ResultWebviewMessage } from './protocol';
import { HttpResultService } from './result-service';

export function createResultViewHandler(_context: vscode.ExtensionContext): WebviewViewHandler {
  const resultService = HttpResultService.getInstance();

  return {
    load: async () => resultService.getState(),
    onResolve: (webview) => {
      resultService.setActiveWebview(webview);
    },
    onMessage: async (message) => {
      if (!isResultWebviewMessage(message)) return;

      switch (message.type) {
        case 'copyToClipboard': {
          await vscode.env.clipboard.writeText(message.text);
          void vscode.window.setStatusBarMessage('Copied to clipboard', 2000);
          break;
        }
        case 'openInEditor': {
          const document = await vscode.workspace.openTextDocument({
            content: message.content,
            language: message.language ?? 'json',
          });
          await vscode.window.showTextDocument(document, { preview: false });
          break;
        }
        case 'rerunRequest': {
          const currentState = resultService.getState();
          let targetRequest =
            currentState.status === 'success'
              ? currentState.response.request
              : currentState.status === 'error'
                ? currentState.error.request
                : undefined;

          if (targetRequest) {
            void resultService.sendRequest(targetRequest);
          }
          break;
        }
      }
    },
    onDispose: () => {
      resultService.setActiveWebview(undefined);
    },
  };
}

function isResultWebviewMessage(message: unknown): message is ResultWebviewMessage {
  return typeof message === 'object' && message !== null && 'type' in message;
}
