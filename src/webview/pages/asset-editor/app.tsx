import { useEffect, useEffectEvent, useState } from 'react';
import type { AssetEditorData, AssetEditorMessage, AssetFormValues } from '@/features/assets/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/button';
import { Checkbox } from '@/webview/components/checkbox';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { SegmentedControl } from '@/webview/components/segmented-control';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function AssetForm({ data }: { data: AssetEditorData }) {
  const [values, setValues] = useState(data.values);
  const [usePrivateKey, setUsePrivateKey] = useState(Boolean(data.values.privateKeyPath));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const mysql = data.assetType === 'mysql';
  const update = <TKey extends keyof AssetFormValues>(key: TKey, value: AssetFormValues[TKey]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };
  const onMessage = useEffectEvent((event: MessageEvent<AssetEditorMessage>) => {
    if (event.data?.type === 'saveError') {
      setError(event.data.message);
      setSaving(false);
    } else if (event.data?.type === 'privateKeySelected') {
      update('privateKeyPath', event.data.path);
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
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (saving) return;
          setError(undefined);
          setSaving(true);
          postToHost({
            type: 'save',
            values: { ...values, privateKeyPath: usePrivateKey ? values.privateKeyPath : '' },
          });
        }}
      >
        <fieldset disabled={saving} className="grid min-w-0 gap-4 border-0 p-0">
          <label className="grid gap-1 text-xs">
            Connection name
            <Input required autoFocus value={values.name} onChange={(event) => update('name', event.target.value)} />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="grid gap-1 text-xs sm:col-span-2">
              Host
              <Input required value={values.host} onChange={(event) => update('host', event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs">
              Port
              <Input
                required
                type="number"
                min={1}
                max={65535}
                step={1}
                value={values.port}
                onChange={(event) => update('port', Number(event.target.value))}
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs">
            User
            <Input
              required
              autoComplete="off"
              value={values.user}
              onChange={(event) => update('user', event.target.value)}
            />
          </label>
          {mysql ? (
            <>
              <label className="grid gap-1 text-xs">
                Password
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={values.password}
                  placeholder={data.editing ? 'Unchanged' : undefined}
                  onChange={(event) => update('password', event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs">
                Default database (optional)
                <Input value={values.database} onChange={(event) => update('database', event.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={values.tls} onCheckedChange={(checked) => update('tls', checked)} />
                TLS certificate verification
              </label>
            </>
          ) : (
            <>
              <div className="grid min-w-0 gap-2">
                <span className="text-xs">Authentication</span>
                <SegmentedControl
                  ariaLabel="Authentication"
                  value={usePrivateKey ? 'key' : 'default'}
                  options={[
                    { value: 'default', label: 'Default SSH' },
                    { value: 'key', label: 'Private key' },
                  ]}
                  disabled={saving}
                  onValueChange={(value) => setUsePrivateKey(value === 'key')}
                />
              </div>
              {usePrivateKey && (
                <div className="grid min-w-0 gap-1">
                  <label htmlFor="private-key" className="text-xs">
                    Private key file
                  </label>
                  <div className="flex min-w-0 gap-2">
                    <Input
                      id="private-key"
                      required
                      value={values.privateKeyPath}
                      onChange={(event) => update('privateKeyPath', event.target.value)}
                    />
                    <Button
                      variant="secondary"
                      title="Select private key file"
                      aria-label="Select private key file"
                      prefix={<Icon name="folder-opened" />}
                      onClick={() => postToHost({ type: 'selectPrivateKey' })}
                    />
                  </div>
                </div>
              )}
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
      </form>
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
