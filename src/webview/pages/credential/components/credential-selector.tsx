import { useState } from 'react';
import type { Credential, CredentialSummary } from '@/features/credential/protocol';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Select, type SelectProps } from '@/webview/components/select';
import { CredentialDialog } from './credential-dialog';

interface CredentialSelectorProps {
  credentials: CredentialSummary[];
  onCreate: (credential: Credential) => void;
}

export function CredentialSelector({
  credentials,
  onCreate,
  ...selectProps
}: CredentialSelectorProps & Omit<SelectProps, 'options' | 'placeholder' | 'aria-label'>) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="flex min-w-0 items-start gap-2">
        <Select
          {...selectProps}
          aria-label="Credential"
          placeholder="Select a credential"
          options={credentials.map((credential) => ({
            value: credential.id,
            label: `${credential.username || '-'} - ${credential.type === 'password' ? 'Password' : 'Private Key'} - ${credential.description || '-'}`,
          }))}
        />
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
