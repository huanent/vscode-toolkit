import { useEffect, useRef } from 'react';
import type { WorkflowResult } from '@/result/protocol';
import { cn } from 'cn';
import { IconButton } from '@webview/components/ui/button';
import { Square } from '@webview/components/ui/icons';
import { vscode } from '@webview/vscodeApi';

export function WorkflowResultView({ result }: { result: WorkflowResult }) {
    const output = useRef<HTMLElement>(null);
    const follow = useRef(true);
    useEffect(() => {
        if (follow.current && output.current) output.current.scrollTop = output.current.scrollHeight;
    }, [result.output]);
    return (
        <div className="grid h-screen min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
            <header className="flex min-w-0 items-center gap-2 border-b border-(--vscode-panel-border) px-3 py-2 font-semibold">
                <span className="min-w-0 flex-1 wrap-anywhere">{result.name}</span>
                {(result.state === 'running' || result.state === 'stopping') && (
                    <IconButton
                        icon={<Square />}
                        label="Stop workflow"
                        title={result.state === 'stopping' ? result.summary : 'Stop workflow'}
                        size="sm"
                        disabled={result.state === 'stopping'}
                        onClick={() => vscode.postMessage({ type: 'cancelWorkflow' })}
                    />
                )}
            </header>
            <main ref={output} className="min-h-0 overflow-auto p-3" onScroll={event => {
                const element = event.currentTarget;
                follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
            }}>
                <pre className="m-0 font-(family-name:--vscode-editor-font-family) text-xs whitespace-pre-wrap wrap-anywhere">{result.output}</pre>
            </main>
            <footer role="status" className={cn(
                'min-w-0 border-t border-(--vscode-panel-border) px-3 py-1 text-xs wrap-anywhere',
                result.state === 'error' && 'text-(--vscode-errorForeground)',
            )}>{result.summary}</footer>
        </div>
    );
}