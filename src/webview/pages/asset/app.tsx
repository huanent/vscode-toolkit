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
import { Input } from '@/webview/components/ui/input';
import { Loading } from '@/webview/components/ui/loading';
import { TabPanel, Tabs } from '@/webview/components/ui/tabs';
import { EditorSaveHeader } from '@/webview/components/editor-save-header';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import { ConnectionPanel } from '@/webview/pages/asset/components/connection-panel';
import { OtherPanel } from '@/webview/pages/asset/components/other-panel';
import { ProxyPanel } from '@/webview/pages/asset/components/proxy-panel';
import '@/webview/styles.css';

function AssetForm({ data }: { data: AssetEditorData }) {
  const [values, setValues] = useState(data.values);
  const [credentials, setCredentials] = useState(data.credentials);
  const [saving, setSaving] = useState(false);
  const [activeTabId, setActiveTabId] = useState('connection');
  const update = (changes: Partial<AssetFormValues>) => {
    setValues((previous) => ({ ...previous, ...changes }));
  };
  const onMessage = useEffectEvent((event: MessageEvent<AssetEditorMessage>) => {
    if (event.data?.type === 'saveFailed') {
      setSaving(false);
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
      id: 'connection',
      label: 'Connection',
      panel: (
        <ConnectionPanel
          values={values}
          capabilities={data.capabilities}
          credentials={credentials}
          assets={data.assets}
          onChange={update}
          onCreateCredential={(credential) => {
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
                value={values.proxyAssetIds}
                connections={data.assets}
                onChange={(proxyAssetIds) => update({ proxyAssetIds })}
              />
            ),
          },
        ]
      : []),
    {
      id: 'other',
      label: 'Other',
      panel: <OtherPanel description={values.description} onDescriptionChange={(description) => update({ description })} />,
    },
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
          setSaving(true);
          postToHost({
            type: 'save',
            values,
          });
        }}
      >
        <fieldset disabled={saving} className="flex min-w-0 flex-1 flex-col border-0 p-0">
          <EditorSaveHeader saving={saving}>
            <FormItem
              name="name"
              error="Name is required."
              match="valueMissing"
              className="min-w-0 max-w-64 grow basis-48"
            >
              <Input
                aria-label="Name"
                className="w-full min-w-0"
                value={values.name}
                onChange={(event) => update({ name: event.target.value })}
                placeholder="Connection name"
                required
                autoFocus
              />
            </FormItem>
            <label className="flex h-6 shrink-0 items-center gap-2 font-medium">
              <Checkbox name="enableAI" checked={values.enableAI} onCheckedChange={(enableAI) => update({ enableAI })} />
              <span>Allow AI access</span>
            </label>
          </EditorSaveHeader>
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
                <div data-asset-section={tab.id} className="mx-auto grid w-full max-w-3xl">
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
