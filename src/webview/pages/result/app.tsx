import { mountWebview } from '@/webview/bootstrap';
import { ResultPanel } from './components/result-panel';
import { TaskHistoryPanel } from './components/task-history-panel';
import { useResultState } from './use-result-state';
import '@/webview/styles.css';

function App() {
  const { state, loading, error } = useResultState();

  return (
    <main className="flex h-screen min-h-0 flex-col md:flex-row">
      <section className="min-h-0 min-w-0 flex-1 overflow-auto">
        <ResultPanel
          task={state?.selectedTask}
          loading={loading && !state}
          error={error && !state ? error : undefined}
        />
      </section>
      <TaskHistoryPanel tasks={state?.tasks ?? []} selectedTaskId={state?.selectedTask?.id} />
    </main>
  );
}

mountWebview('root', <App />);
