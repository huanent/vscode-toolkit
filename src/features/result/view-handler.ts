import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import { resolveStorageDirectory } from '@/host/utils/storage';
import type { ResultWebviewMessage } from './protocol';
import { resultTaskService } from './task-service';

export function createResultViewHandler(context: vscode.ExtensionContext): WebviewViewHandler {
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.result.focus', () =>
      vscode.commands.executeCommand('workbench.view.extension.toolkit_result'),
    ),
  );
  const initialized = resultTaskService.initialize(resolveStorageDirectory(context, 'result2'));

  return {
    load: async () => {
      await initialized;
      return resultTaskService.getState();
    },
    onResolve: (webview) => {
      resultTaskService.setActiveWebview(webview);
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
        case 'selectTask': {
          await resultTaskService.selectTask(message.taskId);
          break;
        }
        case 'terminateTask': {
          await resultTaskService.terminateTask(message.taskId);
          break;
        }
        case 'deleteTask': {
          await resultTaskService.deleteTask(message.taskId);
          break;
        }
      }
    },
    onDispose: () => {
      resultTaskService.setActiveWebview(undefined);
    },
  };
}

function isResultWebviewMessage(message: unknown): message is ResultWebviewMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;

  switch (message.type) {
    case 'copyToClipboard':
      return 'text' in message && typeof message.text === 'string';
    case 'openInEditor': {
      return (
        'content' in message &&
        typeof message.content === 'string' &&
        (!('language' in message) || typeof message.language === 'string')
      );
    }
    case 'selectTask':
    case 'terminateTask':
    case 'deleteTask':
      return 'taskId' in message && typeof message.taskId === 'string';
    default:
      return false;
  }
}
