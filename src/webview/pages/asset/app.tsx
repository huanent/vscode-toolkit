import { useEffect, useEffectEvent, useState } from 'react';
import type {
  AssetEditorData,
  AssetEditorMessage,
  AssetEditorRequest,
  AssetFormValues,
} from '@/features/assets/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Form } from '@/webview/components/ui/form';
import { Loading } from '@/webview/components/ui/loading';
import { TabPanel, Tabs } from '@/webview/components/ui/tabs';
import { StorageEditorHeader } from '@/webview/components/storage-editor-header';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import { ConnectionPanel } from '@/webview/pages/asset/components/connection-panel';
import { GeneralPanel } from '@/webview/pages/asset/components/general-panel';
import { ProxyPanel } from '@/webview/pages/asset/components/proxy-panel';
import '@/webview/styles.css';

function AssetForm({ data }: { data: AssetEditorData }) {
  const [values, setValues] = useState(data.values);
  const [credentials, setCredentials] = useState(data.credentials);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [activeTabId, setActiveTabId] = useState('general');
  const update = (changes: Partial<AssetFormValues>) => {
    setValues((previous) => ({ ...previous, ...changes }));
  };
  const onMessage = useEffectEvent((event: MessageEvent<AssetEditorMessage>) => {
    if (event.data?.type === 'saveError') {
      setError(event.data.message);
      setSaving(false);
    } else if (event.data?.type === 'credentialError') {
      setError(event.data.message);
    } else if (event.data?.type === 'credentialsUpdated') {
      setCredentials(event.data.credentials);
      update({ credentialId: event.data.createdId });
    }
  });
  useEffect(() => {
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const tabs = [
    {
      id: 'general',
      label: 'General',
      panel: <GeneralPanel values={values} onChange={update} />,
    },
    {
      id: 'connection',
      label: 'Connection',
      panel: (
        <ConnectionPanel
          values={values}
          capabilities={data.capabilities}
          credentials={credentials}
          onChange={update}
          onCreateCredential={(credential) => {
            setError(undefined);
            postToHost({ type: 'createCredential', credential } satisfies AssetEditorRequest);
          }}
        />
      ),
    },
    ...(data.capabilities.proxyTunnel
      ? [
          {
            id: 'proxy',
            label: 'Proxy',
            panel: (
              <ProxyPanel
                value={values.proxyAssetId}
                connections={data.sshConnections}
                onChange={(proxyAssetId) => update({ proxyAssetId })}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl text-(--vscode-foreground)">
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
            onStorageScopeChange={(storageScope) => update({ storageScope })}
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
            tabs={tabs}
            activeTabId={activeTabId}
            onChange={setActiveTabId}
            ariaLabel="Asset settings"
            placement="left"
            className="min-w-0 flex-1 mt-2"
          >
            {tabs.map((tab) => (
              <TabPanel key={tab.id} tabId={tab.id} keepMounted className="p-4 md:p-6">
                <div data-asset-section={tab.id} className="mx-auto grid w-full max-w-3xl gap-5">
                  {tab.panel}
                </div>
              </TabPanel>
            ))}
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
