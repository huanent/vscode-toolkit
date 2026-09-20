import { useState } from 'react';
import type { CredentialSummary, CredentialType } from '../../../src/credential/protocol';
import { Button } from '../components/ui/button';
import { Field } from '../components/ui/field';
import { Input, PasswordInput, Select, Textarea } from '../components/ui/input';
import { Save } from '../components/ui/icons';

export const credentialLabels = { password: 'Password', privateKey: 'Private key', apikey: 'API key' };
export type CredentialDraft = Omit<CredentialSummary, 'id'> & { id?: string; secret: string; passphrase?: string };

export function CredentialForm({ entry, busy, onSave, onCancel, types = ['password', 'privateKey', 'apikey'] }: {
    types?: readonly CredentialType[];
    entry: (CredentialSummary & { secret?: string; passphrase?: string }) | null;
    busy: boolean;
    onSave: (draft: CredentialDraft) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState(entry?.name ?? '');
    const [type, setType] = useState<CredentialType>(entry?.type ?? types[0]);
    const [user, setUser] = useState(entry?.user ?? '');
    const [secret, setSecret] = useState(entry?.secret ?? '');
    const [passphrase, setPassphrase] = useState(entry?.passphrase ?? '');
    const secretRequired = !entry || entry.type !== type;
    return (
        <form className="grid min-w-0 gap-4" onSubmit={event => {
            event.preventDefault();
            event.stopPropagation();
            onSave({ id: entry?.id, name, type, user, secret, passphrase: type === 'privateKey' && (!entry || secret || passphrase) ? passphrase : undefined });
        }}>
            <Field label="Name" required>{props => <Input {...props} value={name} disabled={busy} onChange={event => setName(event.target.value)} />}</Field>
            <Field label="Type">{props => <Select {...props} value={type} disabled={busy} onChange={event => { setType(event.target.value as CredentialType); setSecret(''); }}>
                {types.map(value => <option key={value} value={value}>{credentialLabels[value]}</option>)}
            </Select>}</Field>
            {type !== 'apikey' && <Field label="User" required>{props => <Input {...props} autoComplete="off" value={user} disabled={busy} onChange={event => setUser(event.target.value)} />}</Field>}
            <Field label={credentialLabels[type]} required={secretRequired}>{props => type === 'privateKey'
                ? <Textarea {...props} rows={8} spellCheck={false} autoComplete="off" value={secret} disabled={busy} placeholder={secretRequired ? '' : 'Unchanged'} onChange={event => setSecret(event.target.value)} />
                : <PasswordInput {...props} autoComplete="new-password" value={secret} disabled={busy} placeholder={secretRequired ? '' : 'Unchanged'} onChange={event => setSecret(event.target.value)} />}</Field>
            {type === 'privateKey' && <Field label="Key passphrase">{props => <PasswordInput {...props} value={passphrase} disabled={busy} autoComplete="new-password" placeholder={entry ? 'Unchanged' : 'Optional'} onChange={event => setPassphrase(event.target.value)} />}</Field>}
            <div className="flex flex-wrap justify-end gap-2">
                <Button htmlType="submit" disabled={busy} left={<Save />}>Save</Button>
                <Button variant="plain" disabled={busy} onClick={onCancel}>Cancel</Button>
            </div>
        </form>
    );
}