import { useEffect, useState } from 'react';
import { Empty } from '@/webview/components/empty';
import { Loading } from '@/webview/components/loading';
import { mountWebview } from '@/webview/bootstrap';
import { useHostData } from '@/webview/utils/host-data';
import type { HttpResultState, ResultHostMessage } from '@/features/http/protocol';
import { ResponseView } from './components/response-view';
import { ErrorView } from './components/error-view';
import '@/webview/styles.css';

function App() {
  const initial = useHostData<HttpResultState>();
  const [resultState, setResultState] = useState<HttpResultState>();

  useEffect(() => {
    const onMessage = (event: MessageEvent<ResultHostMessage>) => {
      if (event.data?.type === 'resultStateUpdated') {
        setResultState(event.data.state);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const activeState = resultState ?? (initial.status === 'loaded' ? initial.data : { status: 'idle' });

  if (activeState.status === 'pending') {
    return (
      <main className="p-4">
        <Loading label={`Sending ${activeState.request.method} ${activeState.request.url}...`} className="text-sm" />
      </main>
    );
  }

  if (activeState.status === 'success') {
    return (
      <main className="p-3">
        <ResponseView response={activeState.response} />
      </main>
    );
  }

  if (activeState.status === 'error') {
    return (
      <main className="p-3">
        <ErrorView error={activeState.error} />
      </main>
    );
  }

  return (
    <main className="p-4">
      <Empty
        label="No results"
        title="No results yet"
        description="Run an HTTP request using the 'Send Request' CodeLens or command, and its output will appear here."
        icon="cloud-upload"
      />
    </main>
  );
}

mountWebview('root', <App />);
