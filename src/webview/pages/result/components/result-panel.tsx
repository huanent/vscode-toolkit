import { Empty } from '@/webview/components/empty';
import { Loading } from '@/webview/components/loading';
import type { ResultTask } from '@/features/result/protocol';
import { ResultTaskContent } from './task-content';

interface ResultPanelProps {
  task: ResultTask | undefined;
  loading: boolean;
  error: string | undefined;
}

export function ResultPanel({ task, loading, error }: ResultPanelProps) {
  if (task) {
    return <ResultTaskContent key={task.id} task={task} />;
  }

  if (loading) {
    return <Loading label="Loading task history..." className="p-4 text-sm" />;
  }

  if (error) {
    return (
      <Empty label="Task history unavailable" title="Could not load task history" description={error} icon="warning" />
    );
  }

  return (
    <Empty label="No results" title="No results yet" description="Task output will appear here." icon="cloud-upload" />
  );
}
