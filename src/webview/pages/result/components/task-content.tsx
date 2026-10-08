import type { ComponentType } from 'react';
import { Empty } from '@/webview/components/empty';
import { Loading } from '@/webview/components/loading';
import { Icon } from '@/webview/components/icons';
import type { ResultTask } from '@/features/result/protocol';
import { HttpTaskResult } from './http/http-task-result';
import { SqliteQueryResultView } from './database/sqlite-query-result';
import { ResultText } from './result-text';
import { formatTaskDuration, formatTaskKind, taskStatusPresentation } from '../task-presentation';

export type ResultTaskRenderer = ComponentType<{ task: ResultTask }>;

const taskRenderers = new Map<string, ResultTaskRenderer>();
registerResultTaskRenderer('http', HttpTaskResult);
registerResultTaskRenderer('sqlite', SqliteQueryResultView);

export function registerResultTaskRenderer(kind: string, renderer: ResultTaskRenderer): void {
  taskRenderers.set(kind, renderer);
}

function ResultTaskContent({ task }: { task: ResultTask }) {
  const Renderer = taskRenderers.get(task.kind);
  if (Renderer) return <Renderer task={task} />;

  const content = task.output ?? task.error ?? task.input;
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="text-xs text-(--vscode-descriptionForeground)">
        No result renderer is registered for &quot;{task.kind}&quot;.
      </div>
      {content !== undefined && (
        <ResultText
          title="Output"
          content={typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
          language={typeof content === 'string' ? undefined : 'json'}
        />
      )}
    </div>
  );
}

interface ResultPanelProps {
  task: ResultTask | undefined;
  loading: boolean;
  error: string | undefined;
}

export function TaskContent({ task, loading, error }: ResultPanelProps) {
  if (task) {
    const presentation = taskStatusPresentation[task.status];
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-auto" aria-busy={task.status === 'running'}>
          <ResultTaskContent key={task.id} task={task} />
        </div>
        <footer
          aria-label="Task status"
          className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-(--vscode-panel-border) px-3 py-1 text-xs text-(--vscode-descriptionForeground)"
        >
          <span className={`flex items-center gap-1 ${presentation.className}`} role="status">
            <Icon
              name={presentation.icon}
              size="sm"
              className={task.status === 'running' ? 'animate-spin' : undefined}
            />
            {presentation.label}
          </span>
          <span>{formatTaskKind(task.kind)}</span>
          <time dateTime={new Date(task.createdAt).toISOString()}>{new Date(task.createdAt).toLocaleString()}</time>
          {task.status !== 'running' && (
            <span className="font-mono tabular-nums">{formatTaskDuration(task.updatedAt - task.createdAt)}</span>
          )}
        </footer>
      </div>
    );
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
