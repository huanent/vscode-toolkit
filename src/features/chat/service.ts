import * as vscode from 'vscode';
import type { ChatData, ChatDocument, ChatMessage } from '@/features/chat/protocol';

const maxTabTitleDisplayWidth = 24;

/**
 * Builds a stable, unique key for a model. A model ID alone is only unique per vendor, so different
 * providers exposing models with the same ID (common with custom providers) would otherwise collide.
 */
function modelKey(model: vscode.LanguageModelChat): string {
  return `${model.vendor}:${model.id}`;
}

export class ChatService {
  private chat: ChatDocument;
  private models: vscode.LanguageModelChat[] = [];
  private modelOptions: ChatData['models'];
  private lastModelId: string;
  private modelRefresh?: Promise<void>;
  private historyLoad?: Promise<void>;
  private history: ChatData['history'] = [];
  private cancellation?: vscode.CancellationTokenSource;
  private titleGenerationChatId?: string;
  private error?: string;
  private disposed = false;

  constructor(
    private readonly root: vscode.Uri,
    private readonly update: (data: ChatData) => void,
    private readonly cache: vscode.Memento,
    private readonly setTabTitle: (title: string) => void,
  ) {
    this.modelOptions = cache.get<ChatData['models']>('chat.models', []);
    this.lastModelId = cache.get<string>('chat.model', '');
    this.chat = this.createChat();
  }

  private createChat(): ChatDocument {
    return { id: String(Date.now()), modelId: this.lastModelId, messages: [] };
  }

  /** Persists the selected model so new chats and new editor sessions reuse it. */
  private rememberModel(key: string): void {
    if (!key || this.lastModelId === key) return;
    this.lastModelId = key;
    void this.cache.update('chat.model', key);
  }

  selectModel(modelId: string): void {
    const model = this.findModel(modelId);
    if (model) {
      this.rememberModel(modelKey(model));
      return;
    }
    // Model options can come from cache before `selectChatModels` resolves.
    if (this.modelOptions.some((option) => option.value === modelId)) this.rememberModel(modelId);
  }

  private titleFor(chat: ChatDocument): string {
    return (
      chat.title ||
      this.titleFromMessage(chat.messages.find((message) => message.role === 'user')?.content) ||
      'New chat'
    );
  }

  private titleFromMessage(content: string | undefined): string {
    return content?.replace(/\s+/g, ' ').trim().slice(0, 80) || '';
  }

  private updateTabTitle(title: string): void {
    const normalized = title.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      this.setTabTitle('Chat');
      return;
    }

    let displayWidth = 0;
    let truncated = '';
    for (const character of normalized) {
      const characterWidth = character.charCodeAt(0) <= 0xff ? 1 : 2;
      if (displayWidth + characterWidth + 3 > maxTabTitleDisplayWidth) break;
      truncated += character;
      displayWidth += characterWidth;
    }

    this.setTabTitle(truncated.length < normalized.length ? `${truncated.trimEnd()}...` : normalized);
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
      (chat.title !== undefined && typeof chat.title !== 'string') ||
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
        title: this.titleFor(this.chat),
      },
      ...this.history.filter((entry) => entry.id !== this.chat.id),
    ].sort((first, second) => Number(second.id) - Number(first.id));
  }

  get data(): ChatData {
    return {
      chat: this.chat,
      history: this.history,
      models: this.modelOptions,
      busy: !!this.cancellation,
      error: this.error,
    };
  }

  private emit(): void {
    if (!this.disposed) this.update(this.data);
  }

  initialize(): ChatData {
    this.historyLoad = this.loadHistory().catch((error: unknown) => {
      this.error = error instanceof Error ? error.message : String(error);
      this.emit();
    });
    void this.refreshModels();
    return this.data;
  }

  private async loadHistory(): Promise<void> {
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
                title: this.titleFor(chat),
              };
            } catch {
              return undefined;
            }
          }),
      )
    )
      .filter((entry) => entry !== undefined)
      .sort((first, second) => Number(second.id) - Number(first.id));
    this.emit();
  }

  refreshModels(): Promise<void> {
    if (!this.modelRefresh) {
      this.modelRefresh = this.loadModels().finally(() => {
        this.modelRefresh = undefined;
      });
    }
    return this.modelRefresh;
  }

  private async loadModels(): Promise<void> {
    try {
      const seen = new Set<string>();
      const models = (await vscode.lm.selectChatModels()).filter((model) => {
        const key = modelKey(model);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (this.disposed) return;
      this.models = models;
      this.modelOptions = models.map((model) => ({
        value: modelKey(model),
        label: model.name,
        vendor: model.vendor,
        id: model.id,
      }));
      this.migrateModelId();
      this.error = this.models.length
        ? undefined
        : 'No language models available. Sign in to GitHub Copilot or configure a model provider in VS Code.';
      this.emit();
      await this.cache.update('chat.models', this.modelOptions);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    }
    this.emit();
  }

  private findModel(key: string): vscode.LanguageModelChat | undefined {
    return this.models.find((model) => modelKey(model) === key) ?? this.models.find((model) => model.id === key);
  }

  /** Applies the remembered model to chats without one, and upgrades legacy bare model IDs. */
  private migrateModelId(): void {
    const { modelId } = this.chat;
    if (!modelId) {
      if (this.modelOptions.some((option) => option.value === this.lastModelId)) this.chat.modelId = this.lastModelId;
      return;
    }
    if (this.modelOptions.some((option) => option.value === modelId)) return;
    const legacy = this.models.find((model) => model.id === modelId);
    if (legacy) this.chat.modelId = modelKey(legacy);
  }

  async open(id?: string): Promise<void> {
    await this.historyLoad;
    if (this.cancellation) return;
    this.chat = id ? await this.read(id) : this.createChat();
    this.titleGenerationChatId = undefined;
    if (!id) {
      while (this.history.some((entry) => entry.id === this.chat.id)) {
        this.chat.id = String(Number(this.chat.id) + 1);
      }
    }
    this.migrateModelId();
    this.error = undefined;
    this.updateTabTitle(this.titleFor(this.chat));
    this.emit();
  }

  async delete(id: string): Promise<void> {
    await this.historyLoad;
    if (this.disposed || this.cancellation) return;
    await vscode.workspace.fs.delete(this.uri(id));
    this.history = this.history.filter((entry) => entry.id !== id);
    if (this.chat.id === id) {
      await this.open();
      return;
    }
    this.emit();
  }

  async send(content: string, modelId: string): Promise<void> {
    if (this.cancellation || !content.trim()) return;
    await this.historyLoad;
    if (this.modelRefresh) await this.modelRefresh;
    if (this.disposed || this.cancellation) return;
    const model = this.findModel(modelId);
    if (!model) throw new Error('Select an available language model.');
    const isFirstMessage = !this.chat.messages.some((message) => message.role === 'user');
    this.chat.messages.push({ role: 'user', content: content.trim() });
    if (isFirstMessage) {
      this.chat.title = this.titleFromMessage(content);
      this.updateTabTitle(this.chat.title);
    }
    this.chat.modelId = modelKey(model);
    this.rememberModel(this.chat.modelId);
    this.error = undefined;
    this.emit();
    await this.run(model, isFirstMessage);
  }

  async regenerate(modelId: string): Promise<void> {
    if (this.cancellation) return;
    await this.historyLoad;
    if (this.modelRefresh) await this.modelRefresh;
    if (this.disposed || this.cancellation) return;
    if (!this.chat.messages.some((message) => message.role === 'user')) return;
    const model = this.findModel(modelId) ?? this.findModel(this.chat.modelId);
    if (!model) throw new Error('Select an available language model.');
    if (this.chat.messages.at(-1)?.role === 'assistant') this.chat.messages.pop();
    this.rememberModel(this.chat.modelId);
    this.chat.modelId = modelKey(model);
    this.error = undefined;
    this.emit();
    await this.run(model, false);
  }

  private async run(model: vscode.LanguageModelChat, isFirstMessage: boolean): Promise<void> {
    const cancellation = new vscode.CancellationTokenSource();
    this.cancellation = cancellation;
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
      const inputTokens = await this.countTokens(model, this.chat.messages);
      const response = await model.sendRequest(messages, {}, cancellation.token);
      const reply: ChatMessage = { role: 'assistant', content: '', inputTokens };
      this.chat.messages.push(reply);
      let updateTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        for await (const fragment of response.text) {
          if (cancellation.token.isCancellationRequested) break;
          reply.content += fragment;
          if (!updateTimer) {
            updateTimer = setTimeout(() => {
              updateTimer = undefined;
              this.emit();
            }, 50);
          }
        }
        if (isFirstMessage && !cancellation.token.isCancellationRequested) void this.generateTitle(model, this.chat.id);
      } finally {
        clearTimeout(updateTimer);
        this.emit();
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

  private async countTokens(model: vscode.LanguageModelChat, messages: ChatMessage[]): Promise<number | undefined> {
    const content = messages
      .map((message) => message.content)
      .filter((text) => text)
      .join('\n\n');
    if (!content) return undefined;
    try {
      return await model.countTokens(content);
    } catch {
      return undefined;
    }
  }

  private async generateTitle(model: vscode.LanguageModelChat, chatId: string): Promise<void> {
    if (this.titleGenerationChatId === chatId || this.disposed) return;
    this.titleGenerationChatId = chatId;
    const cancellation = new vscode.CancellationTokenSource();
    try {
      const messages = this.chat.messages
        .filter((message) => message.content)
        .map((message) =>
          message.role === 'user'
            ? vscode.LanguageModelChatMessage.User(message.content)
            : vscode.LanguageModelChatMessage.Assistant(message.content),
        );
      const response = await model.sendRequest(
        [
          vscode.LanguageModelChatMessage.User(
            'Create a concise title for this conversation. Return only the title, without quotes, markdown, or punctuation at the end. Use no more than eight words.',
          ),
          ...messages,
        ],
        {},
        cancellation.token,
      );
      let title = '';
      for await (const fragment of response.text) {
        if (cancellation.token.isCancellationRequested) return;
        title += fragment;
      }
      title = title
        .replace(/[\r\n]+/g, ' ')
        .replace(/^['"`]+|['"`]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!title || this.disposed || this.chat.id !== chatId) return;
      this.chat.title = title.slice(0, 80);
      await this.save();
      this.updateTabTitle(this.chat.title);
      this.emit();
    } catch {
      // The message-derived title remains available when summarization fails.
    } finally {
      cancellation.dispose();
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
