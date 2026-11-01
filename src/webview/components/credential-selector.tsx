import { useState } from 'react';
import { cn } from 'cn';
import type { Credential, CredentialSummary } from '@/features/credential/protocol';
import { Select, type SelectProps } from '@/webview/components/ui/select';
import { CredentialDialog } from '@/webview/components/credential-dialog';

const createCredentialValue = '__create-credential__';

interface CredentialSelectorProps {
  credentials: CredentialSummary[];
  onCreate: (credential: Credential) => void;
  allowedTypes: readonly Credential['type'][];
}

export function CredentialSelector({
  credentials,
  onCreate,
  allowedTypes,
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
          ...credentials
            .filter((credential) => allowedTypes.includes(credential.type))
            .map((credential) => ({
              value: credential.id,
              label: `${credential.username || '-'} - ${credential.type === 'password' ? 'Password' : credential.type === 'privateKey' ? 'Private Key' : 'API Key'} - ${credential.description || '-'}`,
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
        allowedTypes={allowedTypes}
        onSave={(credential) => {
          onCreate(credential);
          setDialogOpen(false);
        }}
      />
    </>
  );
}
