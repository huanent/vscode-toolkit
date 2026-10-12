import { useEffect, useEffectEvent, useState } from 'react';
import type {
  AssetEditorData,
  AssetEditorMessage,
  AssetEditorRequest,
  AssetFormValues,
} from '@/features/assets/protocol';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/button';
import { Checkbox } from '@/webview/components/checkbox';
import { CredentialSelector } from '@/webview/pages/credential/components/credential-selector';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function AssetForm({ data }: { data: AssetEditorData }) {
  const [values, setValues] = useState(data.values);
  const [credentials, setCredentials] = useState(data.credentials);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const mysql = data.assetType === 'mysql';
  const ssh = data.assetType === 'ssh';
  const update = <TKey extends keyof AssetFormValues>(key: TKey, value: AssetFormValues[TKey]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };
  const onMessage = useEffectEvent((event: MessageEvent<AssetEditorMessage>) => {
    if (event.data?.type === 'saveError') {
      setError(event.data.message);
      setSaving(false);
    } else if (event.data?.type === 'credentialError') {
      setError(event.data.message);
    } else if (event.data?.type === 'credentialsUpdated') {
      setCredentials(event.data.credentials);
      update('credentialId', event.data.createdId);
    }
  });
  useEffect(() => {
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <header className="mb-6 flex items-center gap-2 border-b border-(--vscode-panel-border) pb-3">
        <Icon name={mysql ? 'database' : 'remote'} size="lg" />
        <h1 className="text-lg font-semibold">
          {data.editing ? 'Edit' : 'New'} {data.label} Connection
        </h1>
      </header>
      <Form
        onFormSubmit={() => {
          if (saving) return;
          setError(undefined);
          setSaving(true);
          postToHost({
            type: 'save',
            values,
          });
        }}
      >
        <fieldset disabled={saving} className="grid min-w-0 gap-4 border-0 p-0">
          <Field.Root name="name" className="grid gap-1 text-xs">
            <Field.Label>Connection name</Field.Label>
            <Input required autoFocus value={values.name} onChange={(event) => update('name', event.target.value)} />
            <Field.Error match="valueMissing" className="text-xs text-(--vscode-errorForeground)">
              Connection name is required.
            </Field.Error>
          </Field.Root>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field.Root name="host" className="grid gap-1 text-xs sm:col-span-2">
              <Field.Label>Host</Field.Label>
              <Input required value={values.host} onChange={(event) => update('host', event.target.value)} />
              <Field.Error match="valueMissing" className="text-xs text-(--vscode-errorForeground)">
                Host is required.
              </Field.Error>
            </Field.Root>
            <Field.Root name="port" className="grid gap-1 text-xs">
              <Field.Label>Port</Field.Label>
              <Input
                required
                type="number"
                min={1}
                max={65535}
                step={1}
                value={values.port}
                onChange={(event) => update('port', Number(event.target.value))}
              />
              <Field.Error className="text-xs text-(--vscode-errorForeground)">
                Enter a port between 1 and 65535.
              </Field.Error>
            </Field.Root>
          </div>
          <CredentialSelector
            credentials={credentials}
            value={values.credentialId}
            onChange={(credentialId) => update('credentialId', credentialId)}
            onCreate={(credential) => {
              setError(undefined);
              postToHost({ type: 'createCredential', credential } satisfies AssetEditorRequest);
            }}
          />
          {ssh && (
            <label className="grid gap-1 text-xs">
              Proxy tunnel (optional)
              <select
                className="h-7 w-full rounded border border-(--vscode-input-border) bg-(--vscode-input-background) px-2 text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none"
                value={values.proxyAssetId ?? ''}
                onChange={(event) => update('proxyAssetId', event.target.value || undefined)}
              >
                <option value="">Direct connection</option>
                {data.sshConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name} ({connection.host}:{connection.port})
                  </option>
                ))}
              </select>
            </label>
          )}
          {mysql && (
            <>
              <label className="grid gap-1 text-xs">
                Default database (optional)
                <Input value={values.database} onChange={(event) => update('database', event.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={values.tls} onCheckedChange={(checked) => update('tls', checked)} />
                TLS certificate verification
              </label>
            </>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="mt-4 wrap-break-word text-xs text-(--vscode-errorForeground)">
            {error}
          </p>
        )}
        <footer className="mt-6 flex gap-2 border-t border-(--vscode-panel-border) pt-4">
          <Button type="submit" disabled={saving} prefix={<Icon name={saving ? 'loading' : 'save'} />}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="secondary" disabled={saving} onClick={() => postToHost({ type: 'cancel' })}>
            Cancel
          </Button>
        </footer>
      </Form>
    </main>
  );
}

function App() {
  const state = useHostData<AssetEditorData>();
  if (state.status === 'loading') return <p className="p-4 text-xs">Loading...</p>;
  if (state.status === 'error')
    return (
      <p role="alert" className="p-4 text-xs text-(--vscode-errorForeground)">
        {state.message}
      </p>
    );
  return <AssetForm data={state.data} />;
}

mountWebview('root', <App />);
