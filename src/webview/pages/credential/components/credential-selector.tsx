import { useState } from 'react';
import type { ComponentPropsWithRef } from 'react';
import type { Credential, CredentialSummary } from '@/features/credential/protocol';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { CredentialDialog } from './credential-dialog';

interface CredentialSelectorProps {
  credentials: CredentialSummary[];
  onCreate: (credential: Credential) => void;
}

export function CredentialSelector({
  credentials,
  onCreate,
  ...selectProps
}: CredentialSelectorProps & ComponentPropsWithRef<'select'>) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="flex min-w-0 items-start gap-2">
        <select
          {...selectProps}
          aria-label="Credential"
          className="h-7 w-full rounded border border-(--vscode-input-border) bg-(--vscode-input-background) px-2 text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none"
        >
          <option value="" disabled>
            Select a credential
          </option>
          {credentials.map((credential) => (
            <option key={credential.id} value={credential.id}>
              {credential.name}
            </option>
          ))}
        </select>
        <Button variant="ghost" prefix={<Icon name="add" />} onClick={() => setDialogOpen(true)}></Button>
      </div>
      <CredentialDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={(credential) => {
          onCreate(credential);
          setDialogOpen(false);
        }}
      />
    </>
  );
}
