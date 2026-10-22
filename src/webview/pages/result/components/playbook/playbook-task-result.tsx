import type { ResultTask } from '@/features/result/protocol';
import type { PlaybookDefinition, PlaybookRunOutcome, PlaybookStepResult } from '@/features/playbook/protocol';
import { ResultText } from '../result-text';
import { PlaybookResultHeader } from './playbook-result-header';
import { PlaybookStepOutput } from './playbook-step-output';

interface PlaybookTaskResultProps {
  task: ResultTask;
}

export function PlaybookTaskResult({ task }: PlaybookTaskResultProps) {
  const outcome = isPlaybookRunOutcome(task.output) ? task.output : undefined;
  const input = task.input as { playbook?: PlaybookDefinition } | undefined;
  const definitions = input?.playbook?.steps ?? [];
  const steps = outcome?.steps ?? definitions.map((): PlaybookStepResult => ({ status: 'pending' }));
  const running = task.status === 'running';
  return (
    <div className="min-w-0 px-3">
      <PlaybookResultHeader title={task.title} status={task.status} steps={steps} />
      <div className="divide-y divide-(--vscode-panel-border)">
        {steps.map((step, index) => (
          <PlaybookStepOutput
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

function isPlaybookRunOutcome(value: unknown): value is PlaybookRunOutcome {
  if (typeof value !== 'object' || value === null) return false;
  const outcome = value as Partial<PlaybookRunOutcome>;
  return (
    typeof outcome.success === 'boolean' &&
    typeof outcome.message === 'string' &&
    (outcome.output === undefined || typeof outcome.output === 'string')
  );
}
