import { useEffect, useId, useRef, useState } from 'react';
import type { WorkflowStepResult } from '@/result/protocol';
import { ChevronDown, ChevronRight } from '@webview/components/ui/icons';

export function formatDuration(milliseconds: number) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const labels = {
    pending: 'Pending', running: 'Running', success: 'Completed', error: 'Failed', cancelled: 'Cancelled', skipped: 'Skipped',
};
const types = { command: 'Local command', ssh: 'SSH command', sftp: 'File transfer' };

export function WorkflowStepOutput({ step, index, now }: { step: WorkflowStepResult; index: number; now: number }) {
    const [expanded, setExpanded] = useState(step.state === 'running' || step.state === 'error' || step.state === 'cancelled');
    const contentId = useId();
    const output = useRef<HTMLPreElement>(null);
    const section = useRef<HTMLElement>(null);
    const follow = useRef(true);
    const Chevron = expanded ? ChevronDown : ChevronRight;
    useEffect(() => {
        if (step.state === 'running') section.current?.scrollIntoView({ block: 'nearest' });
    }, [step.state]);
    useEffect(() => {
        if (expanded && follow.current && output.current) output.current.scrollTop = output.current.scrollHeight;
    }, [step.output, expanded]);
    return (
        <section ref={section} className="min-w-0 border-b border-(--vscode-panel-border)">
            <div className="sticky top-0 z-10 bg-(--vscode-panel-background,var(--vscode-editor-background))">
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={contentId}
                    onClick={() => setExpanded(value => !value)}
                    className="flex w-full min-w-0 cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-(--vscode-list-hoverBackground) focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-(--vscode-focusBorder)"
                >
                    <Chevron className="shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold wrap-anywhere">{index + 1}. {step.name}</span>
                        <span className="text-xs text-(--vscode-descriptionForeground)">{types[step.type]} · {labels[step.state]}</span>
                    </span>
                    {step.startedAt !== undefined && (
                        <span className="shrink-0 text-xs text-(--vscode-descriptionForeground) tabular-nums">
                            {formatDuration((step.finishedAt ?? now) - step.startedAt)}
                        </span>
                    )}
                </button>
            </div>
            <div id={contentId} hidden={!expanded}>
                {step.progress && (
                    <div className="px-3 py-2 text-xs text-(--vscode-descriptionForeground)">
                        <div className="mb-1 flex flex-wrap justify-between gap-2 tabular-nums">
                            <span>{step.progress.total > 0 ? Math.min(100, Math.floor(step.progress.transferred / step.progress.total * 100)) : step.state === 'success' ? 100 : 0}%</span>
                            <span>{step.progress.transferred.toLocaleString()} / {step.progress.total.toLocaleString()} bytes</span>
                        </div>
                        <progress aria-label="File transfer progress" max={step.progress.total || 1} value={step.progress.total ? step.progress.transferred : step.state === 'success' ? 1 : 0} className="block h-1 w-full accent-(--vscode-progressBar-background)" />
                    </div>
                )}
                {step.output ? (
                    <pre ref={output} onScroll={event => {
                        const element = event.currentTarget;
                        follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
                    }} className="m-0 max-h-80 overflow-auto bg-(--vscode-textCodeBlock-background) px-3 py-2 font-(family-name:--vscode-editor-font-family) text-xs whitespace-pre-wrap wrap-anywhere">{step.output}</pre>
                ) : !step.progress && (
                    <p className="m-0 px-3 py-2 text-xs text-(--vscode-descriptionForeground)">
                        {step.state === 'running' ? step.type === 'sftp' ? 'Preparing transfer...' : 'Waiting for output...' : step.state === 'pending' ? 'Waiting to run.' : step.state === 'skipped' ? 'Not executed.' : 'No output.'}
                    </p>
                )}
            </div>
        </section>
    );
}