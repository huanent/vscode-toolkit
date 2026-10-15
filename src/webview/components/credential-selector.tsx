import { useState } from 'react';
import { cn } from 'cn';
import type { Credential, CredentialSummary } from '@/features/credential/protocol';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
import { Select, type SelectProps } from '@/webview/components/ui/select';
import { CredentialDialog } from '@/webview/components/credential-dialog';

interface CredentialSelectorProps {
  credentials: CredentialSummary[];
  onCreate: (credential: Credential) => void;
}

export function CredentialSelector({
  credentials,
  onCreate,
  ...selectProps
}: CredentialSelectorProps & Omit<SelectProps, 'options' | 'placeholder' | 'ariaLabel'>) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="flex min-w-0 items-start gap-2">
        <Select
          {...selectProps}
          className={cn('min-w-0 flex-1', selectProps.className)}
          ariaLabel="Credential"
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
