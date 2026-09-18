import { useEffect, useId, useState } from 'react';
import type { CredentialSummary, CredentialType } from '../../../src/credential/protocol';
import { CredentialForm, credentialLabels } from '../credential/credentialForm';
import { send, subscribe } from '../dashboard/channel';
import { Field } from './ui/field';
import { Select } from './ui/input';
import { IconButton } from './ui/button';
import { Plus, RefreshCw } from './ui/icons';
import { Dialog } from './ui/dialog';

export function CredentialFields({ types, value, onChange, disabled = false }: {
    types: readonly [CredentialType, ...CredentialType[]];
    value: string;
    onChange: (credential: CredentialSummary | undefined) => void;
    disabled?: boolean;
}) {
    const requestId = useId();
    const [entries, setEntries] = useState<CredentialSummary[]>([]);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        const unsubscribe = subscribe('credential', event => {
            const message = event.data;
            if (message.requestId !== requestId) return;
            setBusy(false);
            if (message.type === 'state') { setEntries(message.entries); setError(''); }
            else if (message.type === 'error') setError(message.error);
        });
        send('credential', { type: 'list', requestId });
        return unsubscribe;
    }, [requestId]);
    useEffect(() => subscribe('credential', event => {
        const message = event.data;
        if (message.requestId === requestId && message.saved && message.credential && types.includes(message.credential.type)) {
            onChange(message.credential);
            setOpen(false);
        }
    }), [requestId, onChange, types]);
    const available = entries.filter(entry => types.includes(entry.type));
    return <>
        <Field label="Credential" required error={!open ? error : undefined} action={<>
            <IconButton label="Refresh credentials" icon={<RefreshCw />} disabled={disabled || busy} onClick={() => send('credential', { type: 'list', requestId })} />
            <IconButton label="New credential" icon={<Plus />} disabled={disabled || busy} onClick={() => { setError(''); setOpen(true); }} />
        </>}>
            {control => <Select {...control} value={value} disabled={disabled || busy} onChange={event => onChange(available.find(entry => entry.id === event.target.value))}>
                <option value="">Select credential</option>
                {value && !available.some(entry => entry.id === value) && <option value={value} disabled>Unavailable credential</option>}
                {available.map(entry => <option key={entry.id} value={entry.id}>{entry.name} ({credentialLabels[entry.type]}) - {entry.user}</option>)}
            </Select>}
        </Field>
        <Dialog open={open} title="New credential" closeDisabled={busy} closeOnBackdrop={false} onClose={() => { setOpen(false); setError(''); }}>
            {error && <p role="alert" className="mb-3 text-xs text-(--vscode-errorForeground)">{error}</p>}
            {open && <CredentialForm entry={null} types={types} busy={busy} onCancel={() => setOpen(false)} onSave={credential => {
                setBusy(true);
                setError('');
                send('credential', { type: 'save', credential, requestId });
            }} />}
        </Dialog>
    </>;
}