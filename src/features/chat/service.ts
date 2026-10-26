import * as vscode from 'vscode';
import type { ChatData, ChatDocument, ChatMessage } from '@/features/chat/protocol';

export class ChatService {
  private chat: ChatDocument = this.createChat();
  private models: vscode.LanguageModelChat[] = [];
  private history: ChatData['history'] = [];
  private cancellation?: vscode.CancellationTokenSource;
  private error?: string;
  private disposed = false;

  constructor(
    private readonly root: vscode.Uri,
    private readonly update: (data: ChatData) => void,
  ) {}

  private createChat(): ChatDocument {
    return { id: String(Date.now()), modelId: '', messages: [] };
  }

  private uri(id: string): vscode.Uri {
    if (!/^\d+$/.test(id)) throw new Error('Invalid chat ID.');
    return vscode.Uri.joinPath(this.root, `${id}.json`);
  }

  private async read(id: string): Promise<ChatDocument> {
    const value: unknown = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(this.uri(id))).toString('utf8'));
    if (!value || typeof value !== 'object') throw new Error('Invalid chat file.');
    const chat = value as ChatDocument;
    if (
      chat.id !== id ||
      typeof chat.modelId !== 'string' ||
      !Array.isArray(chat.messages) ||
      !chat.messages.every(
        (message) =>
          message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string',
      )
    )
      throw new Error('Invalid chat file.');
    return chat;
  }

  private async save(): Promise<void> {
    await vscode.workspace.fs.writeFile(this.uri(this.chat.id), Buffer.from(JSON.stringify(this.chat, null, 2)));
    this.history = [
      {
        id: this.chat.id,
        title: this.chat.messages.find((message) => message.role === 'user')?.content.slice(0, 80) || 'New chat',
      },
      ...this.history.filter((entry) => entry.id !== this.chat.id),
    ].sort((first, second) => Number(second.id) - Number(first.id));
  }

  get data(): ChatData {
    return {
      chat: this.chat,
      history: this.history,
      models: this.models.map((model) => ({ value: model.id, label: model.name, vendor: model.vendor })),
      busy: !!this.cancellation,
      error: this.error,
    };
  }

  private emit(): void {
    if (!this.disposed) this.update(this.data);
  }

  async initialize(): Promise<ChatData> {
    await vscode.workspace.fs.createDirectory(this.root);
    const entries = await vscode.workspace.fs.readDirectory(this.root);
    this.history = (
      await Promise.all(
        entries
          .filter(([name, type]) => type === vscode.FileType.File && /^\d+\.json$/.test(name))
          .map(async ([name]) => {
            const id = name.slice(0, -5);
            try {
              const chat = await this.read(id);
              return {
                id,
                title: chat.messages.find((message) => message.role === 'user')?.content.slice(0, 80) || 'New chat',
              };
            } catch {
              return undefined;
            }
          }),
      )
    )
      .filter((entry) => entry !== undefined)
      .sort((first, second) => Number(second.id) - Number(first.id));
    await this.refreshModels();
    return this.data;
  }

  async refreshModels(): Promise<void> {
    try {
      this.models = await vscode.lm.selectChatModels();
      this.error = this.models.length
        ? undefined
        : 'No language models available. Sign in to GitHub Copilot or configure a model provider in VS Code.';
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
    this.emit();
  }

  async open(id?: string): Promise<void> {
    if (this.cancellation) return;
    this.chat = id ? await this.read(id) : this.createChat();
    if (!id) {
      while (this.history.some((entry) => entry.id === this.chat.id)) {
        this.chat.id = String(Number(this.chat.id) + 1);
      }
    }
    this.error = undefined;
    this.emit();
  }

  async send(content: string, modelId: string): Promise<void> {
    if (this.cancellation || !content.trim()) return;
    const model = this.models.find((item) => item.id === modelId);
    if (!model) throw new Error('Select an available language model.');
    const cancellation = new vscode.CancellationTokenSource();
    this.cancellation = cancellation;
    this.error = undefined;
    this.chat.modelId = model.id;
    this.chat.messages.push({ role: 'user', content: content.trim() });
    this.emit();
    try {
      await this.save();
      const messages = this.chat.messages
        .filter((message) => message.content)
        .map((message) =>
          message.role === 'user'
            ? vscode.LanguageModelChatMessage.User(message.content)
            : vscode.LanguageModelChatMessage.Assistant(message.content),
        );
      const response = await model.sendRequest(messages, {}, cancellation.token);
      const reply: ChatMessage = { role: 'assistant', content: '' };
      this.chat.messages.push(reply);
      try {
        for await (const fragment of response.text) {
          if (cancellation.token.isCancellationRequested) break;
          reply.content += fragment;
          this.emit();
        }
      } finally {
        if (reply.content) {
          try {
            reply.outputTokens = await model.countTokens(reply.content);
          } catch {
            reply.outputTokens = undefined;
          }
        }
      }
    } catch (error) {
      if (!cancellation.token.isCancellationRequested)
        this.error = error instanceof Error ? error.message : String(error);
    } finally {
      try {
        await this.save();
      } catch (error) {
        this.error = `Could not save chat: ${error instanceof Error ? error.message : String(error)}`;
      }
      this.cancellation = undefined;
      cancellation.dispose();
      this.emit();
    }
  }

  stop(): void {
    this.cancellation?.cancel();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
  }
}
