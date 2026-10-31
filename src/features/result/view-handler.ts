import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import type { ResultHostMessage, ResultWebviewMessage } from './protocol';
import type { ResultTaskService } from './task-service';

export function createResultViewHandler(resultTaskService: ResultTaskService): WebviewViewHandler {
  let subscription: { dispose(): void } | undefined;

  return {
    load: async () => resultTaskService.getState(),
    onResolve: (webview) => {
      subscription?.dispose();
      subscription = resultTaskService.subscribe(() => {
        void Promise.resolve()
          .then(async () =>
            webview.postMessage({
              type: 'resultStateUpdated',
              state: await resultTaskService.getState(),
            } satisfies ResultHostMessage),
          )
          .catch(() => undefined);
      });
    },
    onMessage: async (message) => {
      if (!isResultWebviewMessage(message)) return;

      switch (message.type) {
        case 'refreshTasks': {
          await resultTaskService.refreshTasks();
          break;
        }
        case 'loadMoreTasks': {
          await resultTaskService.loadMoreTasks();
          break;
        }
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
        case 'saveHttpResponse': {
          const task = resultTaskService.getTask(message.taskId);
          const output = task?.output;
          if (
            task?.kind !== 'http' ||
            task.status !== 'completed' ||
            typeof output !== 'object' ||
            output === null ||
            !('binaryBody' in output) ||
            typeof output.binaryBody !== 'string'
          )
            break;
          const target = await vscode.window.showSaveDialog({ saveLabel: 'Save HTTP response' });
          if (target) await vscode.workspace.fs.writeFile(target, Buffer.from(output.binaryBody, 'base64'));
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
      subscription?.dispose();
      subscription = undefined;
    },
  };
}

function isResultWebviewMessage(message: unknown): message is ResultWebviewMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) return false;

  switch (message.type) {
    case 'refreshTasks':
    case 'loadMoreTasks':
      return true;
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
    case 'saveHttpResponse':
    case 'terminateTask':
    case 'deleteTask':
      return 'taskId' in message && typeof message.taskId === 'string';
    default:
      return false;
  }
}
