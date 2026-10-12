import { useEffect, useState } from 'react';
import { Button } from '@/webview/components/button';
import { Dialog } from '@/webview/components/dialog';
import { Form, FormItem } from '@/webview/components/form';
import { Input } from '@/webview/components/input';
import type { Credential } from '@/features/credential/protocol';

interface CredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential?: Credential;
  onSave: (credential: Credential) => void;
}

export function CredentialDialog({ open, onOpenChange, credential, onSave }: CredentialDialogProps) {
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'password' | 'privateKey'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');

  useEffect(() => {
    if (open) {
      setDescription(credential?.description || '');
      setType(credential?.type || 'password');
      setUsername(credential?.username || '');
      setPassword(credential?.password || '');
      setPrivateKey(credential?.privateKey || '');
      setPassphrase(credential?.passphrase || '');
    }
  }, [open, credential]);

  const handleSave = () => {
    if (!description) return;
    onSave({
      id: credential?.id || '',
      description,
      type,
      username: username || undefined,
      password: type === 'password' ? password || undefined : undefined,
      privateKey: type === 'privateKey' ? privateKey || undefined : undefined,
      passphrase: type === 'privateKey' ? passphrase || undefined : undefined,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={credential ? 'Edit Credential' : 'Add Credential'}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="credential-form">
            Save
          </Button>
        </>
      }
    >
      <Form id="credential-form" onFormSubmit={handleSave} className="flex flex-col gap-3 py-2">
        <FormItem
          name="type"
          label="Type"
          control={{
            value: type,
            onValueChange: (value) => setType(value as 'password' | 'privateKey'),
          }}
        >
          <select className="h-7 w-full rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2  text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none">
            <option value="password">Password</option>
            <option value="privateKey">Private Key</option>
          </select>
        </FormItem>
        <FormItem name="username" label="Username">
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username (optional)"
          />
        </FormItem>
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
        {type === 'privateKey' && (
          <>
            <FormItem
              name="privateKey"
              label="Private Key"
              control={{ value: privateKey, onValueChange: setPrivateKey }}
            >
              <textarea
                className="min-h-24 w-full rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) p-2  text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none"
                placeholder="-----BEGIN PRIVATE KEY-----..."
              />
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
          <textarea
            rows={3}
            className="min-h-24 w-full rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) p-2  text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none"
            placeholder="Credential description"
          />
        </FormItem>
      </Form>
    </Dialog>
  );
}
