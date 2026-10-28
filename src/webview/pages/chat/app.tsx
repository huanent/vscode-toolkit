import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatData, ChatRequest, ChatUpdate } from '@/features/chat/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { CopyButton } from '@/webview/components/copy-button';
import { Button } from '@/webview/components/ui/button';
import { Empty } from '@/webview/components/ui/empty';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Icon } from '@/webview/components/ui/icons';
import { Loading } from '@/webview/components/ui/loading';
import { ChatHistory } from '@/webview/pages/chat/components/chat-history';
import { ChatInput } from '@/webview/pages/chat/components/chat-input';
import { ChatMessage } from '@/webview/pages/chat/components/chat-message';
import { chatProverbs } from '@/webview/pages/chat/components/chat-proverbs';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function request(message: ChatRequest): void {
  postToHost(message);
}

function copyMessage(index: number): void {
  request({ type: 'copy', index });
}

function ChatEmpty() {
  const [proverb] = useState(() => chatProverbs[Math.floor(Math.random() * chatProverbs.length)]);
  return <Empty icon="comment-discussion" title={proverb} />;
}

function App() {
  const [initialData] = useState<ChatData>(() => ({
    chat: { id: '', modelId: '', messages: [] },
    history: [],
    models: [],
    busy: false,
  }));
  const state = useHostData<ChatData, ChatUpdate>((message, previous) =>
    message.type === 'chatUpdated' && previous.status === 'loaded'
      ? { status: 'loaded', data: message.data }
      : undefined,
  );
  if (state.status === 'error') return <ErrorMessage message={state.message} />;
  return (
    <Chat
      data={state.status === 'loaded' ? state.data : initialData}
      error={state.status === 'loaded' ? state.error : undefined}
    />
  );
}

function Chat({ data, error }: { data: ChatData; error?: string }) {
  const [selectedModel, setSelectedModel] = useState('');
  const [pending, setPending] = useState(false);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const modelId =
    [selectedModel, data.chat.modelId, data.models[0]?.value].find((id) =>
      data.models.some((model) => model.value === id),
    ) || '';
  const busy = data.busy || pending;
  const title = data.chat.title || data.history.find((entry) => entry.id === data.chat.id)?.title || 'New chat';

  useEffect(() => {
    if (data.busy || error) setPending(false);
  }, [data.busy, error]);

  useEffect(() => {
    followRef.current = true;
    setAwayFromBottom(false);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [data.chat.id]);

  useEffect(() => {
    if (followRef.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [data.chat.messages]);

  function send(content: string): void {
    if (busy || !content.trim() || !modelId) return;
    followRef.current = true;
    setAwayFromBottom(false);
    setPending(true);
    request({ type: 'send', content, modelId });
  }

  const regenerate = useCallback((): void => {
    if (busy || !modelId) return;
    followRef.current = true;
    setAwayFromBottom(false);
    setPending(true);
    request({ type: 'regenerate', modelId });
  }, [busy, modelId]);

  return (
    <main className="relative flex h-screen min-w-0 flex-col bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-(--vscode-panel-border) px-3 py-1">
        <div className="relative z-10 flex items-center gap-1">
          <ChatHistory
            history={data.history}
            activeId={data.chat.id}
            disabled={busy}
            onSelect={(id) => request({ type: 'open', id })}
            onDelete={(id) => request({ type: 'delete', id })}
          />
          <Button
            variant="ghost"
            title="New chat"
            aria-label="New chat"
            disabled={busy}
            onClick={() => request({ type: 'new' })}
          >
            <Icon name="add" />
          </Button>
        </div>
        <div className="pointer-events-none absolute inset-0 mx-auto flex w-full max-w-3xl items-center px-20">
          <div className="text-sm pointer-events-auto w-full truncate text-center font-semibold" title={title}>
            {title}
          </div>
        </div>
        <div className="relative z-10">
          <CopyButton
            icon="share"
            title="Copy conversation as Markdown"
            copiedTitle="Conversation copied"
            disabled={!data.chat.messages.some((message) => message.content.trim())}
            onCopy={() => request({ type: 'share' })}
          />
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="mx-auto h-full w-full max-w-3xl px-3 overflow-y-auto"
          onScroll={(event) => {
            const target = event.currentTarget;
            followRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 80;
            setAwayFromBottom(!followRef.current);
          }}
        >
          <div className="flex min-h-full w-full flex-col gap-6 py-6">
            {data.chat.id && data.chat.messages.length === 0 && !busy && (
              <div className="flex flex-1 items-center justify-center text-xs">
                <ChatEmpty key={data.chat.id} />
              </div>
            )}
            {data.chat.messages.map((message, index) => {
              const generating = data.busy && message.role === 'assistant' && index === data.chat.messages.length - 1;
              return (
                <ChatMessage
                  key={`${data.chat.id}-${index}`}
                  message={message}
                  index={index}
                  generating={generating}
                  onCopy={copyMessage}
                  onRegenerate={
                    message.role === 'assistant' && index === data.chat.messages.length - 1 ? regenerate : undefined
                  }
                />
              );
            })}
            {busy && (!data.busy || data.chat.messages.at(-1)?.role !== 'assistant') && (
              <Loading label="Responding..." />
            )}
          </div>
        </div>
        {awayFromBottom && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <Button
              variant="secondary"
              title="Scroll to latest message"
              aria-label="Scroll to latest message"
              onClick={() => {
                followRef.current = true;
                setAwayFromBottom(false);
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
              }}
            >
              <Icon name="arrow-down" />
            </Button>
          </div>
        )}
      </div>
      <div className="mx-auto w-full max-w-3xl px-3 shrink-0 py-2">
        {(error || data.error) && (
          <div className="mb-2" role="alert">
            <ErrorMessage message={error || data.error || ''} />
          </div>
        )}
        <ChatInput
          chatId={data.chat.id}
          models={data.models}
          modelId={modelId}
          busy={busy}
          canStop={data.busy}
          sendError={!!error || !!data.error}
          onModelChange={(value) => {
            setSelectedModel(value);
            request({ type: 'selectModel', modelId: value });
          }}
          onSend={send}
          onStop={() => request({ type: 'stop' })}
        />
      </div>
    </main>
  );
}

mountWebview('root', <App />);
