import { useEffect, useState } from 'react';
import { IconButton } from '../components/ui/button';
import { Toolbar } from '../components/ui/toolbar';
import { CollapseAll, File, FolderPlus, Plus } from '../components/ui/icons';
import { List, ListItem } from '../components/ui/list';
import { Tree } from '../components/ui/tree';
import { DashboardEmpty } from '../dashboard/components';
import { Loading } from '../components/ui/loading';
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
    const toggle = (directory: string, open: boolean) => {
        if (open === !!expanded[directory]) return;
        setExpanded(current => ({ ...current, [directory]: open }));
        if (open) send('temp', { type: 'list', directory });
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
                    <List aria-label="Temp files">
                        {entries.map(entry => entry.directory ? (
                            <li key={entry.path}>
                                <Tree
                                    label={entry.name}
                                    open={!!expanded[entry.path]}
                                    onToggle={event => toggle(entry.path, event.currentTarget.open)}
                                    summaryProps={{
                                        title: entry.name,
                                        'data-vscode-context': JSON.stringify({ webviewSection: 'tempFolder', tempPath: entry.path, preventDefaultContextMenuItems: true }),
                                    }}
                                >
                                    {expanded[entry.path] && <TempFiles name={entry.name} entries={children[entry.path]} />}
                                </Tree>
                            </li>
                        ) : <TempFile key={entry.path} entry={entry} />)}
                    </List>
                )}
            </div>
        </section>
    );
}

function TempFiles({ name, entries }: { name: string; entries?: Entry[] }) {
    const files = entries?.filter(entry => !entry.directory);
    return (
        <List aria-label={name}>
            {files === undefined ? (
                <li className="py-1"><Loading variant="inline" /></li>
            ) : files.length === 0 ? (
                <li className="py-1 text-xs text-(--vscode-descriptionForeground)">No files yet.</li>
            ) : files.map(entry => <TempFile key={entry.path} entry={entry} />)}
        </List>
    );
}

function TempFile({ entry }: { entry: Entry }) {
    return (
        <ListItem
            icon={<File />}
            data-vscode-context={JSON.stringify({ webviewSection: 'tempFile', tempPath: entry.path, preventDefaultContextMenuItems: true })}
            onSelect={() => send('temp', { type: 'open', path: entry.path })}
        >
            <span title={entry.name}>{entry.name}</span>
        </ListItem>
    );
}