import type { AssetEditorData, AssetFormValues } from '@/features/assets/protocol';
import type { Credential } from '@/features/credential/protocol';
import { CredentialSelector } from '@/webview/components/credential-selector';
import { Checkbox } from '@/webview/components/ui/checkbox';
import { FormItem } from '@/webview/components/ui/form';
import { Input } from '@/webview/components/ui/input';
import { HttpClientFields } from '@/webview/pages/asset/components/http-client-fields';

type ConnectionPanelProps = {
  values: AssetFormValues;
  capabilities: AssetEditorData['capabilities'];
  credentials: AssetEditorData['credentials'];
  onChange: (values: Partial<AssetFormValues>) => void;
  onCreateCredential: (credential: Credential) => void;
};

export function ConnectionPanel({
  values,
  capabilities,
  credentials,
  onChange,
  onCreateCredential,
}: ConnectionPanelProps) {
  return (
    <>
      {capabilities.httpClient && values.httpClient ? (
        <HttpClientFields value={values.httpClient} onChange={(httpClient) => onChange({ httpClient })} />
      ) : (
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
      )}
      {(!capabilities.httpClient || values.httpClient?.authType !== 'none') && (
        <FormItem
          name="credentialId"
          label={
            values.httpClient?.authType === 'bearer' || values.httpClient?.authType === 'apiKey'
              ? 'Credential (password = token / API key)'
              : 'Credential'
          }
          className="min-w-0 flex-1"
          error="Select a credential."
          match="valueMissing"
        >
          <CredentialSelector
            required
            value={values.credentialId}
            onValueChange={(credentialId) => onChange({ credentialId })}
            credentials={
              capabilities.httpClient ? credentials.filter((credential) => credential.type === 'password') : credentials
            }
            onCreate={onCreateCredential}
          />
        </FormItem>
      )}
      {capabilities.database && (
        <FormItem name="database" label="Default database (optional)" className="min-w-0">
          <Input value={values.database} onChange={(event) => onChange({ database: event.target.value })} />
        </FormItem>
      )}
      {capabilities.tls && (
        <FormItem name="tls" label="TLS certificate verification" className="flex flex-row items-center gap-2">
          <Checkbox checked={values.tls} onCheckedChange={(tls) => onChange({ tls })} />
        </FormItem>
      )}
    </>
  );
}
