import { useEffect, useState } from 'react';
import { Dialog } from '@/webview/components/ui/dialog';
import { Form, FormItem } from '@/webview/components/ui/form';
import { Input } from '@/webview/components/ui/input';
import { Select, type SelectOption } from '@/webview/components/ui/select';
import { Textarea } from '@/webview/components/ui/textarea';
import type { Credential } from '@/features/credential/protocol';

const credentialTypeOptions: readonly SelectOption[] = [
  { value: 'password', label: 'Password' },
  { value: 'privateKey', label: 'Private Key' },
  { value: 'apiKey', label: 'API Key' },
];

interface CredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential?: Credential;
  onSave: (credential: Credential) => void;
  allowedTypes?: readonly Credential['type'][];
}

export function CredentialDialog({ open, onOpenChange, credential, onSave, allowedTypes }: CredentialDialogProps) {
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Credential['type']>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (open) {
      setDescription(credential?.description || '');
      setType(credential?.type || allowedTypes?.[0] || 'password');
      setUsername(credential?.username || '');
      setPassword(credential?.password || '');
      setPrivateKey(credential?.privateKey || '');
      setPassphrase(credential?.passphrase || '');
      setApiKey(credential?.apiKey || '');
    }
  }, [open, credential, allowedTypes]);

  const handleSave = () => {
    if (!description) return;
    const base = {
      id: credential?.id || '',
      description,
    };
    if (type === 'password')
      onSave({ ...base, type, username: username || undefined, password: password || undefined });
    else if (type === 'privateKey')
      onSave({
        ...base,
        type,
        username: username || undefined,
        privateKey: privateKey || undefined,
        passphrase: passphrase || undefined,
      });
    else onSave({ ...base, type, apiKey: apiKey || undefined });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={credential ? 'Edit Credential' : 'Add Credential'}
      form="credential-form"
    >
      <Form id="credential-form" onFormSubmit={handleSave} className="flex flex-col gap-3 py-2">
        <FormItem name="type" label="Type">
          <Select
            ariaLabel="Type"
            value={type}
            onValueChange={(value) => setType(value as Credential['type'])}
            options={credentialTypeOptions.filter(
              (option) => !allowedTypes || allowedTypes.includes(option.value as Credential['type']),
            )}
          />
        </FormItem>
        {type !== 'apiKey' && (
          <FormItem name="username" label="Username">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username (optional)"
            />
          </FormItem>
        )}
        {type === 'password' && (
          <FormItem name="password" label="Password">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
            />
          </FormItem>
        )}
        {type === 'apiKey' && (
          <FormItem name="apiKey" label="API Key">
            <Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
          </FormItem>
        )}
        {type === 'privateKey' && (
          <>
            <FormItem
              name="privateKey"
              label="Private Key"
              control={{ value: privateKey, onValueChange: setPrivateKey }}
            >
              <Textarea className="font-mono" placeholder="-----BEGIN PRIVATE KEY-----..." />
            </FormItem>
            <FormItem name="passphrase" label="Passphrase">
              <Input
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Passphrase (optional)"
              />
            </FormItem>
          </>
        )}
        <FormItem
          name="description"
          label="Description"
          error="Description is required."
          match="valueMissing"
          control={{ value: description, onValueChange: setDescription, required: true }}
        >
          <Textarea rows={3} placeholder="Credential description" />
        </FormItem>
      </Form>
    </Dialog>
  );
}
