import { useState } from 'react';
import { cn } from 'cn';
import type { Credential, CredentialSummary } from '@/features/credential/protocol';
import { Select, type SelectProps } from '@/webview/components/ui/select';
import { CredentialDialog } from '@/webview/components/credential-dialog';

const createCredentialValue = '__create-credential__';

interface CredentialSelectorProps {
  credentials: CredentialSummary[];
  onCreate: (credential: Credential) => void;
}

export function CredentialSelector({
  credentials,
  onCreate,
  onValueChange,
  ...selectProps
}: CredentialSelectorProps & Omit<SelectProps, 'options' | 'placeholder' | 'ariaLabel'>) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Select
        {...selectProps}
        className={cn('min-w-0', selectProps.className)}
        ariaLabel="Credential"
        placeholder="Select a credential"
        options={[
          ...credentials.map((credential) => ({
            value: credential.id,
            label: `${credential.username || '-'} - ${credential.type === 'password' ? 'Password' : 'Private Key'} - ${credential.description || '-'}`,
          })),
          { value: createCredentialValue, label: 'Create credential...' },
        ]}
        onValueChange={(value) => {
          if (value === createCredentialValue) {
            setDialogOpen(true);
            return;
          }
          onValueChange?.(value);
        }}
      />
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
