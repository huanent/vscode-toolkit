import { useEffect, useRef, useState } from 'react';
import type { ChatData, ChatRequest, ChatUpdate } from '@/features/chat/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { CopyButton } from '@/webview/components/copy-button';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Loading } from '@/webview/components/ui/loading';
import { ChatHistory } from '@/webview/pages/chat/components/chat-history';
import { ChatInput } from '@/webview/pages/chat/components/chat-input';
import { ChatMessage } from '@/webview/pages/chat/components/chat-message';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function request(message: ChatRequest): void {
  postToHost(message);
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const modelId =
    [selectedModel, data.chat.modelId, data.models[0]?.value].find((id) =>
      data.models.some((model) => model.value === id),
    ) || '';
  const busy = data.busy || pending;

  useEffect(() => {
    setPending(false);
  }, [data, error]);

  useEffect(() => {
    if (followRef.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [data.chat.messages]);

  useEffect(() => {
    followRef.current = true;
  }, [data.chat.id]);

  function send(content: string): void {
    if (busy || !content.trim() || !modelId) return;
    followRef.current = true;
    setPending(true);
    request({ type: 'send', content, modelId });
  }

  function regenerate(): void {
    if (busy || !modelId) return;
    followRef.current = true;
    setPending(true);
    request({ type: 'regenerate', modelId });
  }

  return (
    <main className="relative flex h-screen min-w-0 flex-col bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
      <div className="absolute left-3 top-2 z-20">
        <ChatHistory
          history={data.history}
          activeId={data.chat.id}
          disabled={busy}
          onSelect={(id) => request({ type: 'open', id })}
          onDelete={(id) => request({ type: 'delete', id })}
        />
      </div>
      <div className="absolute right-3 top-2 z-20">
        <CopyButton
          size="lg"
          icon="share"
          title="Copy conversation as Markdown"
          copiedTitle="Conversation copied"
          disabled={!data.chat.messages.some((message) => message.content.trim())}
          onCopy={() => request({ type: 'share' })}
        />
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          className="mx-auto h-full w-full max-w-3xl px-3 overflow-y-auto"
          onScroll={(event) => {
            const target = event.currentTarget;
            followRef.current = target.scrollHeight - target.scrollTop - target.clientHeight < 80;
          }}
        >
          <div className="flex w-full flex-col gap-6 py-6">
            {data.chat.messages.map((message, index) => {
              const generating = data.busy && message.role === 'assistant' && index === data.chat.messages.length - 1;
              return (
                <ChatMessage
                  key={`${data.chat.id}-${index}`}
                  message={message}
                  generating={generating}
                  onCopy={() => request({ type: 'copy', index })}
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
          onModelChange={setSelectedModel}
          onSend={send}
          onStop={() => request({ type: 'stop' })}
        />
      </div>
    </main>
  );
}

mountWebview('root', <App />);
