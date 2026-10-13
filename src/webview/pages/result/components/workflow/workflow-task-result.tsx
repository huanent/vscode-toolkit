import type { ResultTask } from '@/features/result/protocol';
import type { WorkflowRunOutcome } from '@/features/workflow/protocol';
import { Empty } from '@/webview/components/empty';
import { Loading } from '@/webview/components/loading';
import { ResultText } from '../result-text';

interface WorkflowTaskResultProps {
  task: ResultTask;
}

export function WorkflowTaskResult({ task }: WorkflowTaskResultProps) {
  if (task.status === 'running') {
    return <Loading label="Running workflow..." className="p-4 " />;
  }

  if (!isWorkflowRunOutcome(task.output)) {
    return (
      <Empty
        title="Could not display this workflow task"
        description={task.error ?? 'The saved workflow result is missing or invalid.'}
        icon="warning"
      />
    );
  }

  const outcome = task.output;
  return (
    <div className="flex flex-col gap-4 p-4">
      <div
        role="status"
        className={` font-semibold ${outcome.success ? 'text-(--vscode-testing-iconPassed)' : 'text-(--vscode-errorForeground)'}`}
      >
        {outcome.message}
      </div>
      {outcome.output && <ResultText title="Output" content={outcome.output} />}
    </div>
  );
}

function isWorkflowRunOutcome(value: unknown): value is WorkflowRunOutcome {
  if (typeof value !== 'object' || value === null) return false;
  const outcome = value as Partial<WorkflowRunOutcome>;
  return (
    typeof outcome.success === 'boolean' &&
    typeof outcome.message === 'string' &&
    (outcome.output === undefined || typeof outcome.output === 'string')
  );
}
