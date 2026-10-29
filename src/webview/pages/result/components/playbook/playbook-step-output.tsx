import { useEffect, useState } from 'react';
import type { PlaybookStep, PlaybookStepResult } from '@/features/playbook/protocol';
import { Collapsible } from '@/webview/components/ui/collapsible';
import { Progress } from '@/webview/components/ui/progress';
import { ResultText } from '../result-text';
import { PlaybookStatusIcon } from './playbook-status-icon';

interface PlaybookStepOutputProps {
  index: number;
  definition?: PlaybookStep;
  result: PlaybookStepResult;
  running: boolean;
}

export function PlaybookStepOutput({ index, definition, result, running }: PlaybookStepOutputProps) {
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
        : definition?.type === 'local-command'
          ? 'Local command'
          : 'Step';
  const title = definition?.name || label;
  const duration =
    result.startedAt && result.finishedAt
      ? `${((result.finishedAt - result.startedAt) / 1000).toFixed(1)}s`
      : undefined;
  const transferProgress =
    result.totalBytes !== undefined && result.totalBytes > 0
      ? Math.min(100, Math.max(0, ((result.transferredBytes ?? 0) / result.totalBytes) * 100))
      : undefined;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      headerClassName="sticky top-10 z-10 bg-(--vscode-sideBar-background)"
      title={
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="pt-1">
            <PlaybookStatusIcon status={status} />
          </div>
          <div className="min-w-0 flex-1 flex items-center">
            <div className="wrap-break-word flex-1">
              {index + 1}. {title}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-normal text-(--vscode-descriptionForeground)">
              {duration && <span className="tabular-nums">{duration}</span>}
            </div>
          </div>
        </div>
      }
    >
      <div className="flex min-w-0 flex-col gap-4 pb-4 pl-5">
        {definition && (
          <div className="flex min-w-0 flex-col gap-2 text-xs">
            <div className="font-semibold text-(--vscode-descriptionForeground)">{label}</div>
            <pre className="border-l-2 border-(--vscode-panel-border) pl-2 font-mono text-(--vscode-foreground) select-text whitespace-pre-wrap wrap-break-word">
              {definition.type === 'sftp'
                ? `${definition.localPath}\n${definition.direction === 'upload' ? '->' : '<-'} ${definition.remotePath}`
                : definition.command}
            </pre>
            {definition.type === 'local-command' && definition.cwd && (
              <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-(--vscode-descriptionForeground)">
                <span>Working directory</span>
                <span className="min-w-0 font-mono select-text wrap-break-word">{definition.cwd}</span>
              </div>
            )}
          </div>
        )}
        {result.totalBytes !== undefined && (
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs text-(--vscode-descriptionForeground)">
              <span className="font-semibold text-(--vscode-foreground)">Transfer</span>
              {transferProgress !== undefined && (
                <span className="font-semibold tabular-nums text-(--vscode-foreground)">
                  {Math.floor(transferProgress)}%
                </span>
              )}
            </div>
            <Progress
              aria-label={`Step ${index + 1} transfer progress`}
              value={result.transferredBytes ?? 0}
              max={result.totalBytes || 1}
              animated={status === 'running'}
              className={`h-1 overflow-hidden rounded-sm ${status === 'failed' ? 'text-(--vscode-errorForeground)' : status === 'completed' ? 'text-(--vscode-testing-iconPassed)' : 'text-(--vscode-progressBar-background)'}`}
            />
            <div className="text-xs tabular-nums text-(--vscode-descriptionForeground)">
              <span className="tabular-nums">
                {(result.transferredBytes ?? 0).toLocaleString()} / {result.totalBytes.toLocaleString()} bytes
              </span>
            </div>
          </div>
        )}
        {result.output && <ResultText title={`Output ${result.message}`} content={result.output} />}
      </div>
    </Collapsible>
  );
}
