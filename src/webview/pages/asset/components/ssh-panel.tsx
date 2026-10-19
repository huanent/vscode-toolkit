import { CredentialSelector } from '@/webview/components/credential-selector';
import { FormItem } from '@/webview/components/ui/form';
import { Input } from '@/webview/components/ui/input';
import type { ConnectionPanelProps } from '@/webview/pages/asset/components/connection-panel';

export function SshPanel({ values, credentials, onChange, onCreateCredential }: ConnectionPanelProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormItem
          name="host"
          label="Host"
          className="min-w-0 sm:col-span-2"
          error="Host is required."
          match="valueMissing"
        >
          <Input required value={values.host} onChange={(event) => onChange({ host: event.target.value })} />
        </FormItem>
        <FormItem name="port" label="Port" className="min-w-0" error="Enter a port between 1 and 65535.">
          <Input
            required
            type="number"
            min={1}
            max={65535}
            step={1}
            value={values.port}
            onChange={(event) => onChange({ port: Number(event.target.value) })}
          />
        </FormItem>
      </div>
      <FormItem
        name="credentialId"
        label="Credential"
        className="min-w-0 flex-1"
        error="Select a credential."
        match="valueMissing"
      >
        <CredentialSelector
          required
          value={values.credentialId}
          onValueChange={(credentialId) => onChange({ credentialId })}
          credentials={credentials}
          onCreate={onCreateCredential}
        />
      </FormItem>
    </>
  );
}
