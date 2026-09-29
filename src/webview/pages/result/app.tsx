import { useEffect, useState } from 'react';
import { Empty } from '@/webview/components/empty';
import { Loading } from '@/webview/components/loading';
import { mountWebview } from '@/webview/bootstrap';
import { useHostData } from '@/webview/utils/host-data';
import type { ResultHostMessage, ResultViewState } from '@/features/result/protocol';
import { ResultTaskContent } from './components/task-content';
import { TaskHistoryPanel } from './components/task-history-panel';
import '@/webview/styles.css';

function App() {
  const initial = useHostData<ResultViewState>();
  const [resultState, setResultState] = useState<ResultViewState>();

  useEffect(() => {
    const onMessage = (event: MessageEvent<ResultHostMessage>) => {
      if (event.data?.type === 'resultStateUpdated') {
        setResultState(event.data.state);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const activeState = resultState ?? (initial.status === 'loaded' ? initial.data : undefined);

  return (
    <main className="flex h-screen min-h-0 flex-col md:flex-row">
      <section className="min-h-0 min-w-0 flex-1 overflow-auto p-3">
        {activeState?.selectedTask ? (
          <ResultTaskContent key={activeState.selectedTask.id} task={activeState.selectedTask} />
        ) : initial.status === 'loading' && !activeState ? (
          <Loading label="Loading task history..." className="p-4 text-sm" />
        ) : initial.status === 'error' && !activeState ? (
          <Empty
            label="Task history unavailable"
            title="Could not load task history"
            description={initial.message}
            icon="warning"
          />
        ) : (
          <Empty
            label="No results"
            title="No results yet"
            description="Task output will appear here."
            icon="cloud-upload"
          />
        )}
      </section>
      <TaskHistoryPanel tasks={activeState?.tasks ?? []} selectedTaskId={activeState?.selectedTask?.id} />
    </main>
  );
}

mountWebview('root', <App />);
