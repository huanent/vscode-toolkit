import { mountWebview } from '@/webview/bootstrap';
import { TaskContent } from './components/task-content';
import { TaskHistory } from './components/task-history';
import { useResultState } from './use-result-state';
import '@/webview/styles.css';

function App() {
  const { state, loading, error } = useResultState();

  return (
    <main className="flex h-screen min-h-0 flex-col md:flex-row">
      <section aria-label="Task result" className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <TaskContent
          task={state?.selectedTask}
          loading={loading && !state}
          error={error && !state ? error : undefined}
        />
      </section>
      <TaskHistory tasks={state?.tasks ?? []} selectedTaskId={state?.selectedTask?.id} />
    </main>
  );
}

mountWebview('root', <App />);
