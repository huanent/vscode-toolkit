import { useEffect, useState } from 'react';
import { Button } from '@/webview/components/button';
import { Dialog } from '@/webview/components/dialog';
import { Input } from '@/webview/components/input';
import type { Credential } from '@/features/credential/protocol';

interface CredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credential?: Credential;
  onSave: (credential: Credential) => void;
}

export function CredentialDialog({ open, onOpenChange, credential, onSave }: CredentialDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'password' | 'privateKey'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [passphrase, setPassphrase] = useState('');

  useEffect(() => {
    if (open) {
      setName(credential?.name || '');
      setType(credential?.type || 'password');
      setUsername(credential?.username || '');
      setPassword(credential?.password || '');
      setPrivateKey(credential?.privateKey || '');
      setPassphrase(credential?.passphrase || '');
    }
  }, [open, credential]);

  const handleSave = () => {
    if (!name) return;
    onSave({
      id: credential?.id || '',
      name,
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
          <Button onClick={handleSave} disabled={!name}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 py-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Credential Name" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Type</label>
          <select
            className="h-7 w-full rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 text-xs text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none"
            value={type}
            onChange={(e) => setType(e.target.value as 'password' | 'privateKey')}
          >
            <option value="password">Password</option>
            <option value="privateKey">Private Key</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium">Username</label>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username (optional)" />
        </div>
        {type === 'password' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>
        )}
        {type === 'privateKey' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Private Key</label>
              <textarea
                className="min-h-24 w-full rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) p-2 text-xs text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----..."
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium">Passphrase</label>
              <Input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase (optional)"
              />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
