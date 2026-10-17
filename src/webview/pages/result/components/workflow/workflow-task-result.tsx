import { useEffect, useState } from 'react';
import type { ResultTask } from '@/features/result/protocol';
import type {
  WorkflowDefinition,
  WorkflowRunOutcome,
  WorkflowStep,
  WorkflowStepResult,
} from '@/features/workflow/protocol';
import { Collapsible } from '@/webview/components/ui/collapsible';
import { Icon } from '@/webview/components/ui/icons';
import { ResultText } from '../result-text';

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

function WorkflowStepOutput({
  index,
  definition,
  result,
  running,
}: {
  index: number;
  definition?: WorkflowStep;
  result: WorkflowStepResult;
  running: boolean;
}) {
  const status =
    !running && result.status === 'running'
      ? 'cancelled'
      : !running && result.status === 'pending'
        ? 'skipped'
        : result.status;
  const [open, setOpen] = useState(status === 'running' || status === 'failed');
  useEffect(() => {
    if (status === 'running' || status === 'failed') setOpen(true);
    else if (status === 'completed') setOpen(false);
  }, [status]);
  const label =
    definition?.type === 'sftp'
      ? `SFTP ${definition.direction}`
      : definition?.type === 'ssh-command'
        ? 'SSH command'
        : 'Local command';
  const duration =
    result.startedAt && result.finishedAt
      ? `${((result.finishedAt - result.startedAt) / 1000).toFixed(1)}s`
      : undefined;
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      title={
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 py-1">
          <StepIcon status={status} />
          <div className="min-w-0 flex-1 wrap-break-word">
            {index + 1}. {label}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs font-normal text-(--vscode-descriptionForeground)">
            {duration && <span>{duration}</span>}
          </div>
        </div>
      }
    >
      <div className="flex min-w-0 flex-col gap-3 pb-4 pl-5">
        {definition && (
          <pre className="font-mono text-xs text-(--vscode-descriptionForeground) select-text whitespace-pre-wrap wrap-break-word">
            {definition.type === 'sftp'
              ? `${definition.localPath}\n${definition.direction === 'upload' ? '->' : '<-'} ${definition.remotePath}`
              : definition.command}
            {definition.type === 'local-command' && definition.cwd ? `\n${definition.cwd}` : ''}
          </pre>
        )}
        {result.totalBytes !== undefined && (
          <div className="flex flex-col gap-1">
            <progress
              aria-label={`Step ${index + 1} transfer progress`}
              value={result.transferredBytes ?? 0}
              max={result.totalBytes || 1}
              className="h-1 w-full accent-(--vscode-progressBar-background)"
            />
            <div className="text-xs text-(--vscode-descriptionForeground)">
              {(result.transferredBytes ?? 0).toLocaleString()} / {result.totalBytes.toLocaleString()} bytes
            </div>
          </div>
        )}
        {result.output ? (
          <ResultText title={`Step ${index + 1} output`} content={result.output} />
        ) : (
          <div className="text-xs text-(--vscode-descriptionForeground)">
            {status === 'running' ? 'Waiting for output...' : 'No output'}
          </div>
        )}
        {result.message && (
          <p className="text-xs wrap-break-word text-(--vscode-descriptionForeground)">{result.message}</p>
        )}
      </div>
    </Collapsible>
  );
}

function StepIcon({ status }: { status: WorkflowStepResult['status'] }) {
  const icons = {
    pending: 'circle-outline',
    running: 'loading',
    completed: 'pass',
    failed: 'error',
    cancelled: 'circle-slash',
    skipped: 'debug-step-over',
  };
  const className =
    status === 'running'
      ? 'animate-spin text-(--vscode-progressBar-background)'
      : status === 'completed'
        ? 'text-(--vscode-testing-iconPassed)'
        : status === 'failed'
          ? 'text-(--vscode-errorForeground)'
          : 'text-(--vscode-descriptionForeground)';
  return <Icon name={icons[status]} className={className} />;
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
