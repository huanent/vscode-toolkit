import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import { resolveStorageDirectory } from '@/host/utils/storage';
import { ChatService } from '@/features/chat/service';
import { formatChatAsMarkdown } from '@/features/chat/share';
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
        const current = new ChatService(
          vscode.Uri.file(resolveStorageDirectory(context, 'chats')),
          (data) => {
            void panel.webview.postMessage({ type: 'chatUpdated', data } satisfies ChatUpdate);
          },
          context.globalState,
          (title) => {
            panel.title = title;
          },
        );
        service = current;
        const listener = panel.webview.onDidReceiveMessage(async (message: ChatRequest) => {
          try {
            switch (message?.type) {
              case 'send':
                if (typeof message.content === 'string' && typeof message.modelId === 'string')
                  await current.send(message.content, message.modelId);
                break;
              case 'selectModel':
                if (typeof message.modelId === 'string') current.selectModel(message.modelId);
                break;
              case 'new':
                await current.open();
                break;
              case 'open':
                if (typeof message.id === 'string') await current.open(message.id);
                break;
              case 'delete':
                if (typeof message.id === 'string') {
                  const entry = current.data.history.find((item) => item.id === message.id);
                  if (!entry) break;
                  const choice = await vscode.window.showWarningMessage(
                    `Delete chat "${entry.title}"?`,
                    { modal: true },
                    'Delete',
                  );
                  if (choice === 'Delete') await current.delete(message.id);
                }
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
              case 'share': {
                const { chat, models } = current.data;
                if (!chat.messages.some((item) => item.content.trim())) break;
                const modelLabel = models.find((model) => model.value === chat.modelId)?.label;
                await vscode.env.clipboard.writeText(formatChatAsMarkdown(chat, modelLabel));
                break;
              }
              case 'regenerate':
                if (typeof message.modelId === 'string') await current.regenerate(message.modelId);
                break;
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
      await vscode.commands.executeCommand(
        'vscode.openWith',
        vscode.Uri.parse('toolkit-chat:/chat.toolkit-chat'),
        'toolkit.chatEditor',
      );
    }),
  );
}
