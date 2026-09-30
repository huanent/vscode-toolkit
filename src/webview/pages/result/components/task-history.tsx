import type { ResultTaskStatus, ResultTaskSummary, ResultWebviewMessage } from '@/features/result/protocol';
import { Button } from '@/webview/components/button';
import { Header } from '@/webview/components/header';
import { Icon } from '@/webview/components/icons';
import { List, type ListGroup } from '@/webview/components/list';
import { getDateGroup } from '@/webview/utils/date-groups';
import { postToHost } from '@/webview/utils/host-data';

interface TaskHistoryPanelProps {
  tasks: ResultTaskSummary[];
  selectedTaskId?: string;
}

export function TaskHistory({ tasks, selectedTaskId }: TaskHistoryPanelProps) {
  return (
    <aside className="flex h-72 w-full shrink-0 flex-col border-t border-(--vscode-panel-border) md:h-full md:w-72 md:border-l md:border-t-0">
      <Header action={tasks.length}>Tasks</Header>

      {tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center gap-2 p-4 text-sm text-(--vscode-descriptionForeground)">
          <Icon name="history" size="sm" variant="muted" />
          <span>No tasks yet</span>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-2">
          <List
            ariaLabel="Task history"
            groups={toTaskListGroups(tasks)}
            selectedKey={selectedTaskId}
            onActivate={(task) => selectTask(task.id)}
            onItemClick={(task) => selectTask(task.id)}
          />
        </div>
      )}
    </aside>
  );
}

function toTaskListGroups(tasks: readonly ResultTaskSummary[]): ListGroup<ResultTaskSummary>[] {
  const groups = new Map<string, ResultTaskSummary[]>();
  for (const task of tasks) {
    const dateGroup = getDateGroup(task.createdAt);
    const groupTasks = groups.get(dateGroup.key) ?? [];
    groupTasks.push(task);
    groups.set(dateGroup.key, groupTasks);
  }

  return Array.from(groups, ([groupKey, groupTasks]) => ({
    key: groupKey,
    label: getDateGroup(groupTasks[0].createdAt).label,
    items: groupTasks.map((task) => {
      const presentation = taskStatusPresentation[task.status];
      return {
        key: task.id,
        data: task,
        icon: <Icon name={presentation.icon} className={presentation.className} />,
        label: task.title,
        actions: (
          <>
            {task.status === 'running' && (
              <Button
                variant="ghost"
                title="Terminate task"
                aria-label={`Terminate ${task.title}`}
                onClick={() => terminateTask(task.id)}
                size="sm"
                icon={<Icon name="debug-stop" />}
              ></Button>
            )}
            <Button
              variant="ghost"
              title="Delete task"
              aria-label={`Delete ${task.title}`}
              onClick={() => deleteTask(task.id)}
              size="sm"
              icon={<Icon name="trash" />}
            ></Button>
          </>
        ),
      };
    }),
  }));
}

function selectTask(taskId: string) {
  postToHost({ type: 'selectTask', taskId } satisfies ResultWebviewMessage);
}

function terminateTask(taskId: string) {
  postToHost({ type: 'terminateTask', taskId } satisfies ResultWebviewMessage);
}

function deleteTask(taskId: string) {
  postToHost({ type: 'deleteTask', taskId } satisfies ResultWebviewMessage);
}

const taskStatusPresentation: Record<ResultTaskStatus, { label: string; icon: string; className: string }> = {
  running: { label: 'Running', icon: 'loading', className: 'text-(--vscode-progressBar-background)' },
  completed: { label: 'Completed', icon: 'check', className: 'text-(--vscode-testing-iconPassed)' },
  failed: { label: 'Failed', icon: 'error', className: 'text-(--vscode-errorForeground)' },
  cancelled: { label: 'Cancelled', icon: 'circle-slash', className: 'text-(--vscode-descriptionForeground)' },
  interrupted: { label: 'Interrupted', icon: 'debug-pause', className: 'text-(--vscode-errorForeground)' },
};
