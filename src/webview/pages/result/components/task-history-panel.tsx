import type { ResultTaskStatus, ResultTaskSummary, ResultWebviewMessage } from '@/features/result/protocol';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { postToHost } from '@/webview/utils/host-data';

interface TaskHistoryPanelProps {
  tasks: ResultTaskSummary[];
  selectedTaskId?: string;
}

export function TaskHistoryPanel({ tasks, selectedTaskId }: TaskHistoryPanelProps) {
  return (
    <aside className="flex h-72 w-full shrink-0 flex-col border-t border-(--vscode-panel-border) md:h-full md:w-72 md:border-l md:border-t-0">
      <header className="flex shrink-0 items-center justify-between border-b border-(--vscode-panel-border) px-3 py-2">
        <h2 className="text-sm font-semibold">Tasks</h2>
        <span className="font-mono text-xs text-(--vscode-descriptionForeground)">{tasks.length}</span>
      </header>

      {tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center gap-2 p-4 text-sm text-(--vscode-descriptionForeground)">
          <Icon name="history" size="sm" variant="muted" />
          <span>No tasks yet</span>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto">
          {tasks.map((task) => {
            const isSelected = task.id === selectedTaskId;
            return (
              <li key={task.id} className="flex items-center gap-1 border-b border-(--vscode-panel-border) pr-1">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  className={`min-w-0 flex-1 px-3 py-2 text-left ${isSelected ? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)' : 'hover:bg-(--vscode-list-hoverBackground)'}`}
                  onClick={() => postToHost({ type: 'selectTask', taskId: task.id } satisfies ResultWebviewMessage)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-xs text-(--vscode-descriptionForeground)">{task.kind}</span>
                    <span className="min-w-0 truncate text-sm">{task.title}</span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 text-xs">
                    <span className={getStatusClass(task.status)}>{getStatusLabel(task.status)}</span>
                    <time
                      className="truncate text-(--vscode-descriptionForeground)"
                      dateTime={new Date(task.createdAt).toISOString()}
                    >
                      {formatCreatedAt(task.createdAt)}
                    </time>
                  </span>
                </button>
                <div className="flex shrink-0 items-center">
                  {task.status === 'running' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Terminate task"
                      aria-label={`Terminate ${task.title}`}
                      onClick={() =>
                        postToHost({ type: 'terminateTask', taskId: task.id } satisfies ResultWebviewMessage)
                      }
                    >
                      <Icon name="debug-stop" size="sm" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Delete task"
                    aria-label={`Delete ${task.title}`}
                    onClick={() => postToHost({ type: 'deleteTask', taskId: task.id } satisfies ResultWebviewMessage)}
                  >
                    <Icon name="trash" size="sm" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

function getStatusLabel(status: ResultTaskStatus): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    case 'interrupted':
      return 'Interrupted';
  }
}

function getStatusClass(status: ResultTaskStatus): string {
  switch (status) {
    case 'running':
      return 'text-(--vscode-progressBar-background)';
    case 'completed':
      return 'text-(--vscode-testing-iconPassed)';
    case 'failed':
    case 'interrupted':
      return 'text-(--vscode-errorForeground)';
    case 'cancelled':
      return 'text-(--vscode-descriptionForeground)';
  }
}

function formatCreatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}
