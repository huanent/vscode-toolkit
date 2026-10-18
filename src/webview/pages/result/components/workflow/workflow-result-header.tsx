import type { ResultTask } from '@/features/result/protocol';
import type { WorkflowStepResult } from '@/features/workflow/protocol';
import { Progress } from '@/webview/components/ui/progress';
import { WorkflowStatusIcon } from './workflow-status-icon';

interface WorkflowResultHeaderProps {
  title: string;
  status: ResultTask['status'];
  steps: WorkflowStepResult[];
}

export function WorkflowResultHeader({ title, status, steps }: WorkflowResultHeaderProps) {
  const progress =
    status === 'running'
      ? steps.reduce((completed, step) => {
          if (step.status === 'completed') return completed + 1;
          if (step.status === 'running' && step.totalBytes && step.totalBytes > 0) {
            return completed + Math.min(1, Math.max(0, (step.transferredBytes ?? 0) / step.totalBytes));
          }
          return completed;
        }, 0)
      : Math.max(steps.length, 1);
  const progressColor =
    status === 'running'
      ? 'text-(--vscode-progressBar-background)'
      : status === 'completed'
        ? 'text-(--vscode-testing-iconPassed)'
        : status === 'failed'
          ? 'text-(--vscode-errorForeground)'
          : 'text-(--vscode-descriptionForeground)';

  return (
    <header className="relative">
      <Progress
        aria-label={`${title} progress`}
        value={progress}
        max={Math.max(steps.length, 1)}
        animated={status === 'running'}
        className={`absolute inset-x-0 bottom-0 ${progressColor}`}
      />
      <div className="flex min-w-0 items-center gap-2 py-1">
        <WorkflowStatusIcon status={status === 'interrupted' ? 'cancelled' : status} />
        <h2 className="min-w-0 flex-1 text-base font-semibold wrap-break-word">{title}</h2>
      </div>
    </header>
  );
}
