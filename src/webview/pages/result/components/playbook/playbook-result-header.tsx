import type { ResultTask } from '@/features/result/protocol';
import type { PlaybookStepResult } from '@/features/playbook/protocol';
import { Progress } from '@/webview/components/ui/progress';
import { PlaybookStatusIcon } from './playbook-status-icon';

interface PlaybookResultHeaderProps {
  title: string;
  status: ResultTask['status'];
  steps: PlaybookStepResult[];
}

export function PlaybookResultHeader({ title, status, steps }: PlaybookResultHeaderProps) {
  const completedSteps = steps.filter((step) => step.status === 'completed').length;
  const progress = steps.reduce((completed, step) => {
    if (step.status === 'completed') return completed + 1;
    if (status === 'running' && step.status === 'running' && step.totalBytes && step.totalBytes > 0) {
      return completed + Math.min(1, Math.max(0, (step.transferredBytes ?? 0) / step.totalBytes));
    }
    return completed;
  }, 0);
  const progressColor =
    status === 'running'
      ? 'text-(--vscode-progressBar-background)'
      : status === 'completed'
        ? 'text-(--vscode-testing-iconPassed)'
        : status === 'failed'
          ? 'text-(--vscode-errorForeground)'
          : 'text-(--vscode-disabledForeground)';

  return (
    <header className="sticky top-0 z-20 bg-(--vscode-sideBar-background)">
      <Progress
        aria-label={`${title} progress`}
        value={progress}
        max={Math.max(steps.length, 1)}
        animated={status === 'running'}
        className={`absolute inset-x-0 bottom-0 ${progressColor}`}
      />
      <div className="flex h-10 min-w-0 items-center gap-2">
        <PlaybookStatusIcon status={status === 'interrupted' ? 'cancelled' : status} />
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold" title={title}>
          {title}
        </h2>
        <span className="shrink-0 text-xs font-normal tabular-nums text-(--vscode-descriptionForeground)">
          {completedSteps}/{steps.length} steps
        </span>
      </div>
    </header>
  );
}
