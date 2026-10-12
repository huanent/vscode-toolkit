import { useEffect, useEffectEvent, useState } from 'react';
import type {
  AssetEditorData,
  AssetEditorMessage,
  AssetEditorRequest,
  AssetFormValues,
} from '@/features/assets/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/button';
import { Checkbox } from '@/webview/components/checkbox';
import { Form, FormItem } from '@/webview/components/form';
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
          <FormItem
            name="name"
            label="Connection name"
            className=""
            error="Connection name is required."
            match="valueMissing"
          >
            <Input required autoFocus value={values.name} onChange={(event) => update('name', event.target.value)} />
          </FormItem>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormItem
              name="host"
              label="Host"
              className=" sm:col-span-2"
              error="Host is required."
              match="valueMissing"
            >
              <Input required value={values.host} onChange={(event) => update('host', event.target.value)} />
            </FormItem>
            <FormItem name="port" label="Port" className="" error="Enter a port between 1 and 65535.">
              <Input
                required
                type="number"
                min={1}
                max={65535}
                step={1}
                value={values.port}
                onChange={(event) => update('port', Number(event.target.value))}
              />
            </FormItem>
          </div>
          <FormItem
            name="credentialId"
            className="min-w-0 flex-1"
            error="Select a credential."
            match="valueMissing"
            control={{
              value: values.credentialId,
              onValueChange: (credentialId) => update('credentialId', credentialId),
              required: true,
            }}
          >
            <CredentialSelector
              credentials={credentials}
              onCreate={(credential) => {
                setError(undefined);
                postToHost({ type: 'createCredential', credential } satisfies AssetEditorRequest);
              }}
            />
          </FormItem>
          {ssh && (
            <FormItem
              name="proxyAssetId"
              label="Proxy tunnel (optional)"
              className=""
              control={{
                value: values.proxyAssetId ?? '',
                onValueChange: (value) => update('proxyAssetId', value || undefined),
              }}
            >
              <select className="h-7 w-full rounded border border-(--vscode-input-border) bg-(--vscode-input-background) px-2 text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none">
                <option value="">Direct connection</option>
                {data.sshConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name} ({connection.host}:{connection.port})
                  </option>
                ))}
              </select>
            </FormItem>
          )}
          {mysql && (
            <>
              <FormItem name="database" label="Default database (optional)" className="">
                <Input value={values.database} onChange={(event) => update('database', event.target.value)} />
              </FormItem>
              <FormItem name="tls" label="TLS certificate verification" className="flex flex-row items-center gap-2 ">
                <Checkbox checked={values.tls} onCheckedChange={(checked) => update('tls', checked)} />
              </FormItem>
            </>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="mt-4 wrap-break-word  text-(--vscode-errorForeground)">
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
  if (state.status === 'loading') return <p className="p-4 ">Loading...</p>;
  if (state.status === 'error')
    return (
      <p role="alert" className="p-4  text-(--vscode-errorForeground)">
        {state.message}
      </p>
    );
  return <AssetForm data={state.data} />;
}

mountWebview('root', <App />);
