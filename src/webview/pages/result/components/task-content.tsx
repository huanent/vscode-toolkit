import { useLayoutEffect, useRef, type ComponentType } from 'react';
import { Button } from '@/webview/components/ui/button';
import { Empty } from '@/webview/components/ui/empty';
import { Loading } from '@/webview/components/ui/loading';
import { Icon } from '@/webview/components/ui/icons';
import type { ResultTask, ResultWebviewMessage } from '@/features/result/protocol';
import { postToHost } from '@/webview/utils/host-data';
import { HttpTaskResult } from './http/http-task-result';
import { SqliteQueryResultView } from './database/sqlite-query-result';
import { PlaybookTaskResult } from './playbook/playbook-task-result';
import { ResultText } from './result-text';
import { formatTaskDuration, formatTaskKind, taskStatusPresentation } from '../task-presentation';

export type ResultTaskRenderer = ComponentType<{ task: ResultTask }>;

const taskRenderers = new Map<string, ResultTaskRenderer>();
registerResultTaskRenderer('http', HttpTaskResult);
registerResultTaskRenderer('sqlite', SqliteQueryResultView);
registerResultTaskRenderer('mysql', SqliteQueryResultView);
registerResultTaskRenderer('postgresql', SqliteQueryResultView);
registerResultTaskRenderer('playbook', PlaybookTaskResult);

export function registerResultTaskRenderer(kind: string, renderer: ResultTaskRenderer): void {
  taskRenderers.set(kind, renderer);
}

function ResultTaskContent({ task }: { task: ResultTask }) {
  const Renderer = taskRenderers.get(task.kind);
  if (Renderer) return <Renderer task={task} />;

  const content = task.output ?? task.error ?? task.input;
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className=" text-(--vscode-descriptionForeground)">
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
  const resultScrollRef = useRef<HTMLDivElement>(null);
  const shouldFollowOutputRef = useRef(true);
  const previousTaskIdRef = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    const container = resultScrollRef.current;
    if (!container) return;

    if (previousTaskIdRef.current !== task?.id) {
      previousTaskIdRef.current = task?.id;
      shouldFollowOutputRef.current = true;
    }
    if (shouldFollowOutputRef.current) container.scrollTop = container.scrollHeight;
  }, [task]);

  if (task) {
    const presentation = taskStatusPresentation[task.status];
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div
          ref={resultScrollRef}
          className="min-h-0 flex-1 overflow-auto"
          aria-busy={task.status === 'running'}
          onScroll={(event) => {
            const container = event.currentTarget;
            shouldFollowOutputRef.current = container.scrollHeight - container.clientHeight - container.scrollTop <= 24;
          }}
        >
          <ResultTaskContent key={task.id} task={task} />
        </div>
        <footer
          aria-label="Task status"
          className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-(--vscode-panel-border) px-3 py-1  text-(--vscode-descriptionForeground)"
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
          {task.status === 'running' && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              title="Terminate task"
              aria-label={`Terminate ${task.title}`}
              prefix={<Icon name="debug-stop" />}
              onClick={() => postToHost({ type: 'terminateTask', taskId: task.id } satisfies ResultWebviewMessage)}
            />
          )}
        </footer>
      </div>
    );
  }

  if (loading) {
    return <Loading label="Loading task history..." className="p-4 " />;
  }

  if (error) {
    return <Empty title="Could not load task history" description={error} icon="warning" />;
  }

  return <Empty title="No results yet" description="Task output will appear here." icon="cloud-upload" />;
}
