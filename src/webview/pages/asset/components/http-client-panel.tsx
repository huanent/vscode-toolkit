import type { HttpClientSettings } from '@/features/http/protocol';
import { CredentialSelector } from '@/webview/components/credential-selector';
import { FormItem } from '@/webview/components/ui/form';
import { Input } from '@/webview/components/ui/input';
import { KeyValueEditor } from '@/webview/components/ui/key-value-editor';
import { Select } from '@/webview/components/ui/select';
import type { ConnectionPanelProps } from '@/webview/pages/asset/components/connection-panel';

export function HttpClientPanel({ values, credentials, onChange, onCreateCredential }: ConnectionPanelProps) {
  const value = values.httpClient;
  if (!value) return null;
  const update = <Key extends keyof HttpClientSettings>(key: Key, next: HttpClientSettings[Key]) => {
    onChange({ httpClient: { ...value, [key]: next } });
  };
  return (
    <>
      <FormItem name="baseUrl" label="Base URL" error="Enter an HTTP(S) base URL.">
        <Input required type="url" value={value.baseUrl} onChange={(event) => update('baseUrl', event.target.value)} />
      </FormItem>
      <FormItem name="authType" label="Authentication">
        <Select
          ariaLabel="Authentication"
          value={value.authType}
          onValueChange={(next) => update('authType', next as HttpClientSettings['authType'])}
          options={[
            { value: 'none', label: 'None' },
            { value: 'basic', label: 'Basic' },
            { value: 'bearer', label: 'Bearer token' },
            { value: 'apiKey', label: 'API key' },
          ]}
        />
      </FormItem>
      {value.authType === 'apiKey' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormItem name="apiKeyName" label="API key name">
            <Input required value={value.apiKeyName} onChange={(event) => update('apiKeyName', event.target.value)} />
          </FormItem>
          <FormItem name="apiKeyLocation" label="API key location">
            <Select
              ariaLabel="API key location"
              value={value.apiKeyLocation}
              onValueChange={(next) => update('apiKeyLocation', next as HttpClientSettings['apiKeyLocation'])}
              options={[
                { value: 'header', label: 'Header' },
                { value: 'query', label: 'Query parameter' },
              ]}
            />
          </FormItem>
        </div>
      )}
      <FormItem name="headers" label="Default headers">
        <KeyValueEditor
          value={value.headers}
          onChange={(headers) => update('headers', headers)}
          keyPlaceholder="Header name"
          valuePlaceholder="Header value"
        />
      </FormItem>
      <FormItem name="timeoutMs" label="Timeout (ms)">
        <Input
          required
          type="number"
          min={1}
          max={300000}
          step={1}
          value={value.timeoutMs}
          onChange={(event) => update('timeoutMs', Number(event.target.value))}
        />
      </FormItem>
      {value.authType !== 'none' && (
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
            credentials={credentials.filter((credential) => credential.type === 'password')}
            onCreate={onCreateCredential}
          />
        </FormItem>
      )}
    </>
  );
}
