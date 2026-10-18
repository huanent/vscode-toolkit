import type { ResultTask } from '@/features/result/protocol';
import type { WorkflowDefinition, WorkflowRunOutcome, WorkflowStepResult } from '@/features/workflow/protocol';
import { ResultText } from '../result-text';
import { WorkflowResultHeader } from './workflow-result-header';
import { WorkflowStepOutput } from './workflow-step-output';

interface WorkflowTaskResultProps {
  task: ResultTask;
}

export function WorkflowTaskResult({ task }: WorkflowTaskResultProps) {
  const outcome = isWorkflowRunOutcome(task.output) ? task.output : undefined;
  const input = task.input as { workflow?: WorkflowDefinition } | undefined;
  const definitions = input?.workflow?.steps ?? [];
  const steps = outcome?.steps ?? definitions.map((): WorkflowStepResult => ({ status: 'pending' }));
  const running = task.status === 'running';
  return (
    <div className="min-w-0 px-3">
      <WorkflowResultHeader title={task.title} status={task.status} steps={steps} />
      <div className="divide-y divide-(--vscode-panel-border)">
        {steps.map((step, index) => (
          <WorkflowStepOutput
            key={`${task.id}-${index}`}
            index={index}
            definition={definitions[index]}
            result={step}
            running={running}
          />
        ))}
      </div>
      {!outcome?.steps && outcome?.output && <ResultText title="Output" content={outcome.output} />}
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
