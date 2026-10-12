import { useState } from 'react';
import { Field } from '@base-ui/react/field';
import type { Credential, CredentialSummary } from '@/features/credential/protocol';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { CredentialDialog } from './credential-dialog';

interface CredentialSelectorProps {
  credentials: CredentialSummary[];
  value: string;
  onChange: (credentialId: string) => void;
  onCreate: (credential: Credential) => void;
}

export function CredentialSelector({ credentials, value, onChange, onCreate }: CredentialSelectorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className="flex min-w-0 items-start gap-2">
        <Field.Root name="credentialId" className="grid min-w-0 flex-1 gap-1">
          <Field.Control
            aria-label="Credential"
            required
            value={value}
            onValueChange={onChange}
            className="h-7 w-full rounded border border-(--vscode-input-border) bg-(--vscode-input-background) px-2 text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none"
            render={
              <select>
                <option value="" disabled>
                  Select a credential
                </option>
                {credentials.map((credential) => (
                  <option key={credential.id} value={credential.id}>
                    {credential.name}
                  </option>
                ))}
              </select>
            }
          />
          <Field.Error match="valueMissing" className="text-xs text-(--vscode-errorForeground)">
            Select a credential.
          </Field.Error>
        </Field.Root>
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
