import { useEffect, useState } from 'react';
import type { CredentialSummary } from '../../../src/credential/protocol';
import { Button, IconButton } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog } from '../components/ui/dialog';
import { Toolbar } from '../components/ui/toolbar';
import { Pencil, Plus, RefreshCw, Search, Trash2 } from '../components/ui/icons';
import { DashboardEmpty } from '../dashboard/components';
import { send, subscribe } from '../dashboard/channel';
import { CredentialForm, credentialLabels } from './credentialForm';

export function Credentials() {
    const [entries, setEntries] = useState<CredentialSummary[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<CredentialSummary | null | undefined>(undefined);
    useEffect(() => {
        const unsubscribe = subscribe('credential', event => {
            const message = event.data;
            if (message.type === 'state') {
                setEntries(message.entries);
                setLoaded(true);
                setBusy(false);
                setError('');
                if (message.saved) setEditing(undefined);
            } else if (message.type === 'error') {
                setError(message.error);
                setLoaded(true);
                setBusy(false);
            }
        });
        send('credential', { type: 'list' });
        return unsubscribe;
    }, []);
    const request = (message: object) => {
        setBusy(true);
        setError('');
        send('credential', message);
    };
    const visible = entries.filter(entry => `${entry.name} ${entry.user} ${credentialLabels[entry.type]}`.toLowerCase().includes(search.toLowerCase()));
    const closeForm = () => {
        if (busy) return;
        setEditing(undefined);
        setError('');
    };
    return (
        <section className="flex h-full min-w-0 flex-col overflow-y-auto">
            {error && editing === undefined && <p role="alert" className="py-2 text-xs wrap-anywhere text-(--vscode-errorForeground)">{error}</p>}
            <Toolbar title="Credential" className="py-3">
                <Input className="w-48 max-w-full" size="sm" type="search" aria-label="Search credentials" placeholder="Search credentials" left={<Search />} value={search} onChange={event => setSearch(event.target.value)} />
                <IconButton label="Refresh credentials" icon={<RefreshCw />} disabled={busy} onClick={() => request({ type: 'list' })} />
                <Button size="sm" left={<Plus />} disabled={busy || !loaded} onClick={() => { setError(''); setEditing(null); }}>New credential</Button>
            </Toolbar>
            <div className="mt-3 min-h-0 flex-1 overflow-auto">
                <table aria-label="Credentials" className="w-full min-w-120 table-fixed border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-(--vscode-editor-background) text-xs text-(--vscode-descriptionForeground)">
                        <tr className="border-b border-(--vscode-panel-border)">
                            <th scope="col" className="px-3 py-2 font-medium">Name</th>
                            <th scope="col" className="w-32 px-3 py-2 font-medium">Type</th>
                            <th scope="col" className="px-3 py-2 font-medium">User</th>
                            <th scope="col" className="w-24 px-3 py-2 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map(entry => <tr key={entry.id} className="border-b border-(--vscode-panel-border) hover:bg-(--vscode-list-hoverBackground)">
                            <th scope="row" className="px-3 py-2 font-normal wrap-anywhere">{entry.name}</th>
                            <td className="px-3 py-2">{credentialLabels[entry.type]}</td>
                            <td className="px-3 py-2 wrap-anywhere">{entry.user || '-'}</td>
                            <td className="px-3 py-2">
                                <div className="flex justify-end">
                                    <IconButton label={`Edit ${entry.name}`} icon={<Pencil />} disabled={busy} onClick={() => { setError(''); setEditing(entry); }} />
                                    <IconButton label={`Delete ${entry.name}`} icon={<Trash2 />} disabled={busy} onClick={() => request({ type: 'delete', id: entry.id })} />
                                </div>
                            </td>
                        </tr>)}
                        {(!loaded || !visible.length) && <tr><td colSpan={4}>
                            <DashboardEmpty loading={!loaded} noun="credentials" filtered={!!search} onClear={() => setSearch('')} />
                        </td></tr>}
                    </tbody>
                </table>
            </div>
            <Dialog open={editing !== undefined} title={editing ? 'Edit credential' : 'New credential'} onClose={closeForm} closeDisabled={busy} closeOnBackdrop={false}>
                {error && <p role="alert" className="mb-3 text-xs wrap-anywhere text-(--vscode-errorForeground)">{error}</p>}
                {editing !== undefined && <CredentialForm key={editing?.id ?? 'new'} entry={editing} busy={busy}
                    onSave={credential => request({ type: 'save', credential })} onCancel={closeForm} />}
            </Dialog>
        </section>
    );
}