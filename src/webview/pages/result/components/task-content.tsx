import type { ComponentType } from 'react';
import type { ResultTask } from '@/features/result/protocol';
import { HttpTaskResult } from './http-task-result';
import { SqliteQueryResultView } from './sqlite-query-result';

export type ResultTaskRenderer = ComponentType<{ task: ResultTask }>;

const taskRenderers = new Map<string, ResultTaskRenderer>();
registerResultTaskRenderer('http', HttpTaskResult);
registerResultTaskRenderer('sqlite', SqliteQueryResultView);

export function registerResultTaskRenderer(kind: string, renderer: ResultTaskRenderer): void {
  taskRenderers.set(kind, renderer);
}

interface ResultTaskContentProps {
  task: ResultTask;
}

export function ResultTaskContent({ task }: ResultTaskContentProps) {
  const Renderer = taskRenderers.get(task.kind);
  if (Renderer) return <Renderer task={task} />;

  const content = task.output ?? task.error ?? task.input;
  return (
    <div className="flex flex-col gap-3 p-1">
      <div className="text-sm font-semibold">{task.title}</div>
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
