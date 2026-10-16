import { useState } from 'react';
import type { HttpClientSettings } from '@/features/http/protocol';
import { FormItem } from '@/webview/components/ui/form';
import { Input } from '@/webview/components/ui/input';
import { Select } from '@/webview/components/ui/select';
import { Textarea } from '@/webview/components/ui/textarea';

export function HttpClientFields({
  value,
  onChange,
}: {
  value: HttpClientSettings;
  onChange: (value: HttpClientSettings) => void;
}) {
  const [headers, setHeaders] = useState(() => JSON.stringify(value.headers, null, 2));
  const update = <Key extends keyof HttpClientSettings>(key: Key, next: HttpClientSettings[Key]) => {
    onChange({ ...value, [key]: next });
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
      <FormItem name="headers" label="Default headers (JSON)" error="Enter a JSON object with string values.">
        <Textarea
          rows={5}
          value={headers}
          onChange={(event) => {
            const target = event.target;
            setHeaders(target.value);
            try {
              const parsed: unknown = JSON.parse(target.value);
              if (
                !parsed ||
                typeof parsed !== 'object' ||
                Array.isArray(parsed) ||
                !Object.values(parsed).every((entry) => typeof entry === 'string')
              ) {
                throw new Error('Invalid headers.');
              }
              target.setCustomValidity('');
              update('headers', parsed as Record<string, string>);
            } catch {
              target.setCustomValidity('Enter a JSON object with string values.');
            }
          }}
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
    </>
  );
}
