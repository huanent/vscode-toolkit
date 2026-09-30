import type { ComponentType } from 'react';
import { Empty } from '@/webview/components/empty';
import { Header } from '@/webview/components/header';
import { Loading } from '@/webview/components/loading';
import type { ResultTask } from '@/features/result/protocol';
import { HttpTaskResult } from './http/http-content';
import { SqliteQueryResultView } from './database/sqlite-query-result';

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
    <div className="flex flex-col gap-3 p-1">
      <div className="text-xs text-(--vscode-descriptionForeground)">
        No result renderer is registered for &quot;{task.kind}&quot;.
      </div>
      {content !== undefined && (
        <pre className="max-h-125 overflow-auto rounded border border-(--vscode-panel-border) bg-(--vscode-editor-background) p-3 font-mono text-xs leading-relaxed text-(--vscode-editor-foreground) select-text whitespace-pre-wrap break-all">
          {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
        </pre>
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
    return (
      <div className="flex h-full min-h-0 flex-col">
        <Header className="px-4 shrink-0" action={`${Math.max(0, task.updatedAt - task.createdAt)} ms`}>
          {task.title}
        </Header>
        <div className="min-h-0 flex-1 overflow-auto">
          <ResultTaskContent key={task.id} task={task} />
        </div>
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
