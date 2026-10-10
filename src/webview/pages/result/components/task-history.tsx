import { useState } from 'react';
import type { ResultTaskSummary, ResultWebviewMessage } from '@/features/result/protocol';
import type { WebviewReadyMessage } from '@/shared/webview-protocol';
import { Button } from '@/webview/components/button';
import { Empty } from '@/webview/components/empty';
import { Header } from '@/webview/components/header';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { List, type ListGroup } from '@/webview/components/list';
import { getDateGroup } from '@/webview/utils/date-groups';
import { postToHost } from '@/webview/utils/host-data';
import { cn } from 'cn';
import { formatTaskKind, taskStatusPresentation } from '../task-presentation';

interface TaskHistoryPanelProps {
  tasks: ResultTaskSummary[];
  selectedTaskId?: string;
}

export function TaskHistory({ tasks, selectedTaskId }: TaskHistoryPanelProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const filteredTasks = tasks.filter((task) =>
    `${task.title} ${formatTaskKind(task.kind)} ${taskStatusPresentation[task.status].label}`
      .toLowerCase()
      .includes(query),
  );
  return (
    <aside
      aria-label="Task history"
      className="flex h-48 w-full shrink-0 flex-col border-t border-(--vscode-panel-border) bg-(--vscode-sideBar-background) md:h-full md:w-72 md:border-l md:border-t-0"
    >
      <Header
        action={
          <Button
            variant="ghost"
            size="sm"
            title="Refresh tasks"
            aria-label="Refresh tasks"
            prefix={<Icon name="refresh" />}
            onClick={() => postToHost({ type: 'ready' } satisfies WebviewReadyMessage)}
          />
        }
      >
        Tasks
        <span className="rounded-sm bg-(--vscode-badge-background) px-1 text-(--vscode-badge-foreground)">
          {tasks.length}
        </span>
      </Header>

      {tasks.length > 0 && (
        <div className="px-3 pb-2">
          <Input
            aria-label="Filter tasks"
            placeholder="Filter tasks"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            prefix={<Icon name="search" size="sm" />}
          />
        </div>
      )}

      {tasks.length === 0 ? (
        <Empty title="No tasks yet" description="Task history will appear here." icon="history" />
      ) : filteredTasks.length === 0 ? (
        <div className="p-3 text-xs text-(--vscode-descriptionForeground)" role="status">
          No matching tasks
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-2">
          <List
            ariaLabel="Task history"
            groups={toTaskListGroups(filteredTasks)}
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
        icon: (
          <Icon
            name={presentation.icon}
            className={cn(presentation.className, 'shrink-0 p-1', task.status === 'running' && 'animate-spin')}
          />
        ),
        label: (
          <span className="flex min-w-0 flex-col gap-1 py-2" title={task.title}>
            <span className="truncate">{task.title}</span>
            <span className="flex items-center gap-2 text-(--vscode-descriptionForeground)">
              <span>{formatTaskKind(task.kind)}</span>
              <span>{presentation.label}</span>
            </span>
          </span>
        ),
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
