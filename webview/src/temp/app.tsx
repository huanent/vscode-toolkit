import { useEffect, useState } from 'react';
import { IconButton } from '../components/ui/button';
import { Toolbar } from '../components/ui/toolbar';
import { ChevronDown, ChevronRight, CollapseAll, File, Folder, FolderPlus, Plus } from '../components/ui/icons';
import { DashboardEmpty } from '../dashboard/components';
import { send, subscribe } from '../dashboard/channel';

type Entry = { name: string; path: string; directory: boolean };

export function Temp() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [children, setChildren] = useState<Record<string, Entry[]>>({});
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        const unsubscribe = subscribe('temp', event => {
            const message = event.data;
            if (message.type === 'entries') {
                if (message.directory === '') {
                    setEntries(message.entries);
                    setLoading(false);
                } else {
                    setChildren(current => ({ ...current, [message.directory]: message.entries }));
                }
                setError('');
            } else if (message.type === 'error') {
                setError(message.message);
                setLoading(false);
            }
        });
        send('temp', { type: 'list', directory: '' });
        return unsubscribe;
    }, []);
    const toggle = (directory: string) => {
        setExpanded(current => ({ ...current, [directory]: !current[directory] }));
        if (!expanded[directory]) send('temp', { type: 'list', directory });
    };
    return (
        <section className="flex h-full min-h-0 flex-col">
            <Toolbar title="Temp" className="py-2">
                <IconButton label="New file" icon={<Plus />} disabled={loading} onClick={() => send('temp', { type: 'newFile', directory: '' })} />
                <IconButton label="New folder" icon={<FolderPlus />} disabled={loading} onClick={() => send('temp', { type: 'newFolder', directory: '' })} />
                <IconButton label="Collapse all" icon={<CollapseAll />} disabled={loading || !entries.some(entry => entry.directory && expanded[entry.path])} onClick={() => setExpanded({})} />
            </Toolbar>
            {error && <p role="alert" className="wrap-break-word py-2 text-xs text-(--vscode-errorForeground)">{error}</p>}
            <div className="min-h-0 flex-1 overflow-auto">
                {loading || entries.length === 0 ? <DashboardEmpty loading={loading} noun="files" /> : (
                    <ul aria-label="Temp files">
                        {entries.map(entry => (
                            <li key={entry.path}>
                                {entry.directory ? (
                                    <>
                                        <div className="flex min-w-0 items-center gap-1" data-vscode-context={JSON.stringify({ webviewSection: 'tempFolder', tempPath: entry.path, preventDefaultContextMenuItems: true })}>
                                            <button
                                                type="button"
                                                title={entry.name}
                                                aria-expanded={!!expanded[entry.path]}
                                                className="flex min-w-0 flex-1 items-center gap-2 rounded-xs px-2 py-1.5 text-left text-xs hover:bg-(--vscode-list-hoverBackground) focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-(--vscode-focusBorder)"
                                                onClick={() => toggle(entry.path)}
                                            >
                                                {expanded[entry.path] ? <ChevronDown className="shrink-0" /> : <ChevronRight className="shrink-0" />}
                                                <Folder className="shrink-0" />
                                                <span className="min-w-0 truncate">{entry.name}</span>
                                            </button>
                                        </div>
                                        {expanded[entry.path] && (
                                            <ul aria-label={entry.name} className="pl-5">
                                                {children[entry.path] === undefined ? (
                                                    <li className="px-2 py-1 text-xs text-(--vscode-descriptionForeground)">Loading...</li>
                                                ) : children[entry.path].filter(child => !child.directory).length === 0 ? (
                                                    <li className="px-2 py-1 text-xs text-(--vscode-descriptionForeground)">No files yet.</li>
                                                ) : children[entry.path].filter(child => !child.directory).map(child => (
                                                    <li key={child.path}><TempFile entry={child} /></li>
                                                ))}
                                            </ul>
                                        )}
                                    </>
                                ) : <TempFile entry={entry} />}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}

function TempFile({ entry }: { entry: Entry }) {
    return (
        <div className="flex min-w-0 items-center gap-1" data-vscode-context={JSON.stringify({ webviewSection: 'tempFile', tempPath: entry.path, preventDefaultContextMenuItems: true })}>
            <button
                type="button"
                title={entry.name}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xs px-2 py-1.5 text-left text-xs hover:bg-(--vscode-list-hoverBackground) focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-(--vscode-focusBorder)"
                onClick={() => send('temp', { type: 'open', path: entry.path })}
            >
                <File className="shrink-0" />
                <span className="min-w-0 truncate">{entry.name}</span>
            </button>
        </div>
    );
}