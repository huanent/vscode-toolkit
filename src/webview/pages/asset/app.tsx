import { useEffect, useEffectEvent, useState } from 'react';
import type {
  AssetEditorData,
  AssetEditorMessage,
  AssetEditorRequest,
  AssetFormValues,
} from '@/features/assets/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Checkbox } from '@/webview/components/ui/checkbox';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Form, FormItem } from '@/webview/components/ui/form';
import { CredentialSelector } from '@/webview/components/credential-selector';
import { Input } from '@/webview/components/ui/input';
import { Loading } from '@/webview/components/ui/loading';
import { Select } from '@/webview/components/ui/select';
import { Textarea } from '@/webview/components/ui/textarea';
import { TabPanel, Tabs } from '@/webview/components/ui/tabs';
import { StorageEditorHeader } from '@/webview/components/storage-editor-header';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import { HttpClientFields } from '@/webview/pages/asset/components/http-client-fields';
import '@/webview/styles.css';

function AssetForm({ data }: { data: AssetEditorData }) {
  const [values, setValues] = useState(data.values);
  const [credentials, setCredentials] = useState(data.credentials);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [activeTabId, setActiveTabId] = useState('general');
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
    <main className="mx-auto min-h-screen w-full max-w-3xl text-(--vscode-foreground)">
      <Form
        className="flex min-h-screen flex-col"
        onInvalidCapture={(event) => {
          const section = (event.target as HTMLElement).closest<HTMLElement>('[data-asset-section]');
          if (section?.dataset.assetSection) setActiveTabId(section.dataset.assetSection);
        }}
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
          <Tabs
            tabs={[
              { id: 'general', label: 'Basic' },
              { id: 'connection', label: 'Connection' },
              ...(data.capabilities.proxyTunnel ? [{ id: 'proxy', label: 'Proxy' }] : []),
            ]}
            activeTabId={activeTabId}
            onChange={setActiveTabId}
            ariaLabel="Asset settings"
            placement="left"
            className="min-w-0 flex-1"
          >
            <TabPanel tabId="general" keepMounted className="p-4 md:p-6">
              <div data-asset-section="general" className="mx-auto grid w-full max-w-3xl gap-5">
                <FormItem name="name" label="Name" error="Name is required." match="valueMissing">
                  <Input
                    aria-label="Name"
                    value={values.name}
                    onChange={(event) => update('name', event.target.value)}
                    placeholder="Connection name"
                    required
                    autoFocus
                  />
                </FormItem>
                <FormItem name="description" label="Description (optional)">
                  <Textarea
                    rows={3}
                    value={values.description}
                    onChange={(event) => update('description', event.target.value)}
                  />
                </FormItem>
                <FormItem name="enableAI" label="Allow AI tool access">
                  <Checkbox checked={values.enableAI} onCheckedChange={(checked) => update('enableAI', checked)} />
                </FormItem>
              </div>
            </TabPanel>
            <TabPanel tabId="connection" keepMounted className="p-4 md:p-6">
              <div data-asset-section="connection" className="mx-auto grid w-full max-w-3xl gap-5">
                {data.capabilities.httpClient && values.httpClient ? (
                  <HttpClientFields value={values.httpClient} onChange={(value) => update('httpClient', value)} />
                ) : (
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
                )}
                {(!data.capabilities.httpClient || values.httpClient?.authType !== 'none') && (
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
                      onValueChange={(credentialId) => update('credentialId', credentialId)}
                      credentials={
                        data.capabilities.httpClient
                          ? credentials.filter((credential) => credential.type === 'password')
                          : credentials
                      }
                      onCreate={(credential) => {
                        setError(undefined);
                        postToHost({ type: 'createCredential', credential } satisfies AssetEditorRequest);
                      }}
                    />
                  </FormItem>
                )}
                {data.capabilities.database && (
                  <FormItem name="database" label="Default database (optional)" className="min-w-0">
                    <Input value={values.database} onChange={(event) => update('database', event.target.value)} />
                  </FormItem>
                )}
                {data.capabilities.tls && (
                  <FormItem
                    name="tls"
                    label="TLS certificate verification"
                    className="flex flex-row items-center gap-2"
                  >
                    <Checkbox checked={values.tls} onCheckedChange={(checked) => update('tls', checked)} />
                  </FormItem>
                )}
              </div>
            </TabPanel>
            {data.capabilities.proxyTunnel && (
              <TabPanel tabId="proxy" keepMounted className="p-4 md:p-6">
                <div data-asset-section="proxy" className="mx-auto grid w-full max-w-3xl gap-5">
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
                </div>
              </TabPanel>
            )}
          </Tabs>
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
