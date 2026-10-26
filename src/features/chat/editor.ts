import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import { ChatService } from '@/features/chat/service';
import type { ChatRequest, ChatUpdate } from '@/features/chat/protocol';

export function registerChat(context: vscode.ExtensionContext): void {
  let service: ChatService | undefined;
  context.subscriptions.push(
    registerWebviewEditor(context, {
      viewType: 'toolkit.chatEditor',
      page: 'chat',
      icon: 'comment-discussion',
      title: () => 'Chat',
      load: async () => {
        if (!service) throw new Error('Chat is unavailable.');
        return service.initialize();
      },
      onPanelResolved: (_uri, panel) => {
        if (!context.storageUri) throw new Error('Open a folder or workspace to store chats.');
        const current = new ChatService(vscode.Uri.joinPath(context.storageUri, 'chats'), (data) => {
          void panel.webview.postMessage({ type: 'chatUpdated', data } satisfies ChatUpdate);
        });
        service = current;
        const listener = panel.webview.onDidReceiveMessage(async (message: ChatRequest) => {
          try {
            switch (message?.type) {
              case 'send':
                if (typeof message.content === 'string' && typeof message.modelId === 'string')
                  await current.send(message.content, message.modelId);
                break;
              case 'new':
                await current.open();
                break;
              case 'open':
                if (typeof message.id === 'string') await current.open(message.id);
                break;
              case 'stop':
                current.stop();
                break;
              case 'copy': {
                if (!Number.isInteger(message.index) || message.index < 0) break;
                const reply = current.data.chat.messages[message.index];
                if (reply?.role === 'assistant') await vscode.env.clipboard.writeText(reply.content);
                break;
              }
            }
          } catch (error) {
            void panel.webview.postMessage({
              type: 'error',
              message: error instanceof Error ? error.message : String(error),
            });
          }
        });
        const models = vscode.lm.onDidChangeChatModels(() => void current.refreshModels());
        return vscode.Disposable.from(listener, models, current);
      },
    }),
    vscode.commands.registerCommand('toolkit.chat.open', async () => {
      if (!context.storageUri) {
        await vscode.window.showErrorMessage('Open a folder or workspace to store chats.');
        return;
      }
      await vscode.commands.executeCommand(
        'vscode.openWith',
        vscode.Uri.parse('toolkit-chat:/chat.toolkit-chat'),
        'toolkit.chatEditor',
      );
    }),
  );
}
