import { useEffect, useState } from 'react';
import type { WorkflowResult } from '@/result/protocol';
import { cn } from 'cn';
import { LoaderCircle } from '@webview/components/ui/icons';
import { formatDuration, WorkflowStepOutput } from './workflowStepOutput';

export function WorkflowResultView({ result }: { result: WorkflowResult }) {
    const [now, setNow] = useState(Date.now);
    const isActive = result.state === 'running' || result.state === 'stopping';
    const completed = result.steps.filter(step => step.state === 'success').length;
    useEffect(() => {
        if (!isActive) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [isActive]);
    return (
        <div className="flex flex-col h-screen min-w-0 overflow-hidden">
            <header className="grid h-10 shrink-0 min-w-0 grid-rows-[minmax(0,1fr)_1px]">
                <div className="flex min-w-0 items-center gap-2 px-3 text-xs whitespace-nowrap">
                    <h2 className="m-0 min-w-0 max-w-1/3 truncate text-sm font-semibold" title={result.name}>{result.name}</h2>
                    <div role="status" className={cn(
                        'flex min-w-0 flex-1 items-center gap-2',
                        result.state === 'error' ? 'text-(--vscode-errorForeground)' : 'text-(--vscode-descriptionForeground)',
                    )}>
                        {isActive && <LoaderCircle className="shrink-0 animate-spin" aria-hidden="true" />}
                        <span className="min-w-0 truncate" title={result.summary}>{result.summary}</span>
                    </div>
                    <span className="shrink-0 text-(--vscode-descriptionForeground) tabular-nums" aria-label="Total duration">{formatDuration((result.finishedAt ?? now) - result.startedAt)}</span>
                </div>
                <div role="progressbar" aria-label="Completed steps" aria-valuemin={0} aria-valuemax={result.steps.length || 1} aria-valuenow={completed} className="h-px bg-(--vscode-panel-border)">
                    <div className="h-full bg-(--vscode-progressBar-background) transition-[width] motion-reduce:transition-none" style={{ width: `${result.steps.length ? completed / result.steps.length * 100 : 0}%` }} />
                </div>
            </header>
            <main className="flex-1 min-h-0 overflow-auto" aria-label="Workflow steps">
                {result.steps.map((step, index) => (
                    <WorkflowStepOutput key={`${result.runId}-${index}-${step.state}`} step={step} index={index} now={now} />
                ))}
            </main>
        </div>
    );
}