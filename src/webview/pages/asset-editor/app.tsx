import { useEffect, useEffectEvent, useState } from 'react';
import type { AssetEditorData, AssetEditorMessage, AssetFormValues } from '@/features/assets/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/button';
import { Checkbox } from '@/webview/components/checkbox';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function AssetForm({ data }: { data: AssetEditorData }) {
  const [values, setValues] = useState(data.values);
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
            values,
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
            Credential
            <select
              required
              className="h-7 w-full rounded border border-(--vscode-input-border) bg-(--vscode-input-background) px-2 text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none"
              value={values.credentialId}
              onChange={(event) => update('credentialId', event.target.value)}
            >
              <option value="" disabled>
                Select a credential
              </option>
              {data.credentials.map((cred) => (
                <option key={cred.id} value={cred.id}>
                  {cred.name}
                </option>
              ))}
            </select>
          </label>
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
