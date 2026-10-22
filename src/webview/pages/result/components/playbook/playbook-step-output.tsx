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
  const hasDefinition = definition !== undefined;
  const [open, setOpen] = useState(hasDefinition && (status === 'running' || status === 'failed'));
  useEffect(() => {
    if (hasDefinition && (status === 'running' || status === 'failed')) setOpen(true);
    else if (status === 'completed') setOpen(false);
  }, [status, hasDefinition]);
  const label =
    definition?.type === 'sftp'
      ? `SFTP ${definition.direction}`
      : definition?.type === 'ssh-command'
        ? 'SSH command'
        : 'Local command';
  const title = definition?.name || label;
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
          <PlaybookStatusIcon status={status} />
          <div className="min-w-0 flex-1 wrap-break-word">
            {index + 1}. {title}
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
            <Progress
              aria-label={`Step ${index + 1} transfer progress`}
              value={result.transferredBytes ?? 0}
              max={result.totalBytes || 1}
            />
            <div className="text-xs text-(--vscode-descriptionForeground)">
              {(result.transferredBytes ?? 0).toLocaleString()} / {result.totalBytes.toLocaleString()} bytes
            </div>
          </div>
        )}
        {result.output && (
          <ResultText title={`Step ${index + 1} output`} description={result.message} content={result.output} />
        )}
      </div>
    </Collapsible>
  );
}
