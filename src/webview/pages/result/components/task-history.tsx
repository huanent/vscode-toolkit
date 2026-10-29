import type { ResultTaskSummary, ResultWebviewMessage } from '@/features/result/protocol';
import { Button } from '@/webview/components/ui/button';
import { Empty } from '@/webview/components/ui/empty';
import { Icon } from '@/webview/components/ui/icons';
import { List, type ListGroup } from '@/webview/components/ui/list';
import { getDateGroup } from '@/webview/utils/date-groups';
import { postToHost } from '@/webview/utils/host-data';
import { cn } from 'cn';
import { useEffect, useRef } from 'react';
import { taskStatusPresentation } from '../task-presentation';

interface TaskHistoryPanelProps {
  tasks: ResultTaskSummary[];
  selectedTaskId?: string;
  hasMore: boolean;
}

export function TaskHistory({ tasks, selectedTaskId, hasMore }: TaskHistoryPanelProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          postToHost({ type: 'loadMoreTasks' } satisfies ResultWebviewMessage);
      },
      { root: element.parentElement },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, tasks.length]);
  return (
    <aside
      aria-label="Task history"
      className="flex h-48 w-full shrink-0 flex-col border-t border-(--vscode-panel-border) bg-(--vscode-sideBar-background) md:h-full md:w-72 md:border-l md:border-t-0"
    >
      <header className="flex min-h-8 shrink-0 items-center justify-between gap-2 px-2 py-1">
        <h2 className="flex min-w-0 items-center gap-2 wrap-break-word  font-semibold">Tasks</h2>
        <div className="flex shrink-0 items-center gap-1  tabular-nums text-(--vscode-descriptionForeground)">
          <Button
            variant="ghost"
            size="sm"
            title="Refresh tasks"
            aria-label="Refresh tasks"
            prefix={<Icon name="refresh" />}
            onClick={() => postToHost({ type: 'refreshTasks' } satisfies ResultWebviewMessage)}
          />
        </div>
      </header>

      {tasks.length === 0 ? (
        <Empty title="No tasks yet" description="Task history will appear here." icon="history" />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-2">
          <List
            ariaLabel="Task history"
            groups={toTaskListGroups(tasks)}
            selectedKey={selectedTaskId}
            onActivate={(task) => selectTask(task.id)}
            onItemClick={(task) => selectTask(task.id)}
          />
          {hasMore && <div ref={sentinel} className="h-1" />}
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
        icon: (
          <Icon
            name={presentation.icon}
            className={cn(presentation.className, 'p-1', task.status === 'running' && 'animate-spin')}
          />
        ),
        label: <span title={task.title}>{task.title}</span>,
        actions:
          task.status === 'running' ? (
            <Button
              variant="ghost"
              title="Terminate task"
              aria-label={`Terminate ${task.title}`}
              onClick={() => terminateTask(task.id)}
              size="sm"
              prefix={<Icon name="debug-stop" />}
            />
          ) : (
            <Button
              variant="ghost"
              title="Delete task"
              aria-label={`Delete ${task.title}`}
              onClick={() => deleteTask(task.id)}
              size="sm"
              prefix={<Icon name="trash" />}
            />
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
