import { useEffect, useEffectEvent, useState } from 'react';
import type {
  AssetEditorData,
  AssetEditorMessage,
  AssetEditorRequest,
  AssetFormValues,
} from '@/features/assets/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/ui/button';
import { Checkbox } from '@/webview/components/ui/checkbox';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Form, FormItem } from '@/webview/components/ui/form';
import { CredentialSelector } from '@/webview/components/credential-selector';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { Loading } from '@/webview/components/ui/loading';
import { Select } from '@/webview/components/ui/select';
import { StorageEditorHeader } from '@/webview/components/storage-editor-header';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function AssetForm({ data }: { data: AssetEditorData }) {
  const [values, setValues] = useState(data.values);
  const [credentials, setCredentials] = useState(data.credentials);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
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
    <main className="min-h-screen text-(--vscode-foreground)">
      <Form
        className="flex min-h-screen flex-col"
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
        <fieldset disabled={saving} className="flex min-w-0 flex-1 flex-col border-0 p-0">
          <StorageEditorHeader
            name={values.name}
            onNameChange={(name) => update('name', name)}
            namePlaceholder="Connection name"
            nameRequired
            nameAutoFocus
            storageScope={values.storageScope}
            onStorageScopeChange={(storageScope) => update('storageScope', storageScope)}
            workspaceStorageAvailable={data.workspaceStorageAvailable}
            saveDisabled={saving}
            saving={saving}
          />
          {error && (
            <div role="alert" className="px-4 py-3">
              <ErrorMessage message={error} />
            </div>
          )}
          <section aria-label="Connection settings" className="min-w-0 flex-1 p-4 md:p-6">
            <div className="mx-auto grid w-full max-w-3xl gap-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormItem
                  name="host"
                  label="Host"
                  className="min-w-0 sm:col-span-2"
                  error="Host is required."
                  match="valueMissing"
                >
                  <Input required value={values.host} onChange={(event) => update('host', event.target.value)} />
                </FormItem>
                <FormItem name="port" label="Port" className="min-w-0" error="Enter a port between 1 and 65535.">
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
                label="Credential"
                className="min-w-0 flex-1"
                error="Select a credential."
                match="valueMissing"
              >
                <CredentialSelector
                  required
                  value={values.credentialId}
                  onValueChange={(credentialId) => update('credentialId', credentialId)}
                  credentials={credentials}
                  onCreate={(credential) => {
                    setError(undefined);
                    postToHost({ type: 'createCredential', credential } satisfies AssetEditorRequest);
                  }}
                />
              </FormItem>
              {data.capabilities.proxyTunnel && (
                <FormItem name="proxyAssetId" label="Proxy tunnel (optional)" className="min-w-0">
                  <Select
                    ariaLabel="Proxy tunnel"
                    value={values.proxyAssetId ?? ''}
                    onValueChange={(value) => update('proxyAssetId', value || undefined)}
                    options={[
                      { value: '', label: 'Direct connection' },
                      ...data.sshConnections.map((connection) => ({
                        value: connection.id,
                        label: `${connection.name} (${connection.host}:${connection.port})`,
                      })),
                    ]}
                  />
                </FormItem>
              )}
              {data.capabilities.database && (
                <FormItem name="database" label="Default database (optional)" className="min-w-0">
                  <Input value={values.database} onChange={(event) => update('database', event.target.value)} />
                </FormItem>
              )}
              {data.capabilities.tls && (
                <FormItem name="tls" label="TLS certificate verification" className="flex flex-row items-center gap-2">
                  <Checkbox checked={values.tls} onCheckedChange={(checked) => update('tls', checked)} />
                </FormItem>
              )}
              <FormItem name="enableAI" label="Allow AI tool access" className="flex flex-row items-center gap-2">
                <Checkbox checked={values.enableAI} onCheckedChange={(checked) => update('enableAI', checked)} />
              </FormItem>
            </div>
          </section>
        </fieldset>
      </Form>
    </main>
  );
}

function App() {
  const state = useHostData<AssetEditorData>();
  if (state.status !== 'loaded')
    return (
      <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        {state.status === 'loading' ? <Loading label="Loading..." /> : <ErrorMessage message={state.message} />}
      </main>
    );
  return <AssetForm data={state.data} />;
}

mountWebview('root', <App />);
