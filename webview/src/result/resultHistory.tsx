import { Fragment, useState, type UIEvent } from 'react';
import type { ResultHistoryMessage, ResultTask } from '@/result/protocol';
import { IconButton } from '@webview/components/ui/button';
import { List, ListGroup, ListItem } from '@webview/components/ui/list';
import { CircleAlert, CircleCheck, CircleSlash, LoaderCircle, RefreshCw, Square, Trash2 } from '@webview/components/ui/icons';
import { vscode } from '@webview/vscodeApi';
import { getHistoryGroup } from '@webview/lib/history';

export function ResultHistory({ history }: { history: ResultHistoryMessage }) {
    const [visibleCount, setVisibleCount] = useState(30);
    const tasks = [...history.tasks].sort((first, second) => second.startedAt - first.startedAt || second.id.localeCompare(first.id));
    const groups = new Map<string, ResultTask[]>();
    for (const task of tasks.slice(0, visibleCount)) {
        const label = getHistoryGroup(task.startedAt);
        const group = groups.get(label) ?? [];
        group.push(task);
        groups.set(label, group);
    }
    const loadNextPage = (event: UIEvent<HTMLUListElement>) => {
        const list = event.currentTarget;
        if (visibleCount < tasks.length && list.scrollTop + list.clientHeight >= list.scrollHeight - 32) {
            setVisibleCount(current => Math.min(current + 30, tasks.length));
        }
    };
    return (
        <aside className="flex min-h-0 min-w-0 flex-col border-l border-(--vscode-panel-border)" aria-label="Result history">
            <header className="flex h-10 shrink-0 items-center gap-2 px-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold" title="Tasks">Tasks</span>
                <IconButton size="sm" icon={<RefreshCw />} label="Refresh tasks" title="Refresh tasks" onClick={() => vscode.postMessage({ type: 'refreshTasks' })} />
            </header>
            <List className="flex-1 overflow-auto p-2" aria-label="Result tasks" onScroll={loadNextPage}>
                {[...groups].map(([label, items]) => {
                    const entries = items.map(task => {
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
                    });
                    return label === 'Today'
                        ? <Fragment key={label}>{entries}</Fragment>
                        : <ListGroup key={label} label={label}>{entries}</ListGroup>;
                })}
            </List>
        </aside>
    );
}
