import type { ResultHistoryMessage } from '@/result/protocol';
import { IconButton } from '@webview/components/ui/button';
import { List, ListItem } from '@webview/components/ui/list';
import { CircleAlert, CircleCheck, CircleSlash, LoaderCircle, Square, Trash2 } from '@webview/components/ui/icons';
import { vscode } from '@webview/vscodeApi';

export function ResultHistory({ history }: { history: ResultHistoryMessage }) {
    return (
        <aside className="flex min-h-0 min-w-0 flex-col border-l border-(--vscode-panel-border)" aria-label="Result history">
            <header className="flex h-10 shrink-0 items-center gap-2 px-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold" title="Result History">Result History</span>
                <span className="shrink-0 text-right text-xs text-(--vscode-descriptionForeground) tabular-nums" aria-label="Result count">{history.tasks.length}</span>
            </header>
            <List className="flex-1 overflow-auto p-1" aria-label="Result tasks">
                {history.tasks.map(task => {
                    const isActive = task.state === 'running' || task.state === 'stopping';
                    const Icon = isActive ? LoaderCircle : task.state === 'error' ? CircleAlert : task.state === 'cancelled' ? CircleSlash : CircleCheck;
                    return (
                        <ListItem
                            key={task.id}
                            selected={history.selectedId === task.id}
                            onSelect={() => vscode.postMessage({ type: 'selectTask', id: task.id })}
                            icon={<Icon className={isActive ? 'animate-spin' : undefined} />}
                            actions={isActive ? (
                                <IconButton size="sm" icon={<Square />} label={task.state === 'stopping' ? 'Stopping...' : 'Stop'} disabled={!task.cancellable || task.state === 'stopping'} onClick={() => vscode.postMessage({ type: 'cancelTask', id: task.id })} />
                            ) : (
                                <IconButton size="sm" icon={<Trash2 />} label="Delete" onClick={() => vscode.postMessage({ type: 'deleteTask', id: task.id })} />
                            )}
                        >
                            <span title={task.label}>{task.label}</span>
                        </ListItem>
                    );
                })}
            </List>
        </aside>
    );
}