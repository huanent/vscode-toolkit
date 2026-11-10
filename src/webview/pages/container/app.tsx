import { useEffect, useEffectEvent, useState } from 'react';
import type { ContainerEditorData, ContainerEditorMessage, ContainerEditorRequest, ContainerInfo } from '@/features/container/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/ui/button';
import { DataList, type DataListColumn } from '@/webview/components/ui/data-list';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Icon } from '@/webview/components/ui/icons';
import { Loading } from '@/webview/components/ui/loading';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function ContainerList({ data }: { data: ContainerEditorData }) {
  const [containers, setContainers] = useState(data.containers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [logs, setLogs] = useState<{ id: string; text: string }>();
  const onMessage = useEffectEvent((event: MessageEvent<ContainerEditorMessage>) => {
    const message = event.data;
    if (message?.type === 'containersUpdated') {
      setContainers(message.containers);
      setBusy(false);
    } else if (message?.type === 'logs') {
      setLogs({ id: message.id, text: message.logs });
      setBusy(false);
    } else if (message?.type === 'containerError') {
      setError(message.message);
      setBusy(false);
    }
  });
  useEffect(() => {
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const request = (message: ContainerEditorRequest) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    postToHost(message);
  };
  const columns: DataListColumn<ContainerInfo>[] = [
    { key: 'name', header: 'Name', className: 'w-40 shrink-0 truncate', cell: (row) => row.name },
    { key: 'image', header: 'Image', className: 'w-48 shrink-0 truncate', cell: (row) => row.image },
    { key: 'status', header: 'Status', className: 'min-w-40 flex-1 truncate', cell: (row) => row.status },
    {
      key: 'actions', header: 'Actions', className: 'w-36 shrink-0', align: 'right',
      cell: (row) => {
        const running = row.state.toLowerCase() === 'running';
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" disabled={busy || running} title="Start" aria-label={`Start ${row.name}`} prefix={<Icon name="play" />} onClick={() => request({ type: 'start', id: row.id })} />
            <Button variant="ghost" size="sm" disabled={busy || !running} title="Stop" aria-label={`Stop ${row.name}`} prefix={<Icon name="debug-stop" />} onClick={() => request({ type: 'stop', id: row.id })} />
            <Button variant="ghost" size="sm" disabled={busy} title="Restart" aria-label={`Restart ${row.name}`} prefix={<Icon name="debug-restart" />} onClick={() => request({ type: 'restart', id: row.id })} />
            <Button variant="ghost" size="sm" disabled={busy} title="Logs" aria-label={`Logs for ${row.name}`} prefix={<Icon name="output" />} onClick={() => { setLogs(undefined); request({ type: 'logs', id: row.id }); }} />
          </div>
        );
      },
    },
  ];
  return (
    <main className="flex h-screen min-w-0 flex-col text-(--vscode-foreground)">
      <header className="flex shrink-0 items-center gap-3 border-b border-(--vscode-panel-border) px-4 py-2">
        <h1 className="min-w-0 flex-1 truncate font-semibold">{data.assetName}</h1>
        <Button shortcut="refresh" variant="secondary" disabled={busy} prefix={<Icon name="refresh" />} onClick={() => request({ type: 'list' })}>Refresh</Button>
      </header>
      {error && <ErrorMessage message={error} />}
      <DataList ariaLabel="Containers" entries={containers} columns={columns} entryKey={(row) => row.id} emptyMessage={busy ? 'Loading containers...' : 'No containers.'} />
      {logs && (
        <section aria-label="Container logs" className="flex max-h-72 min-h-0 shrink-0 flex-col border-t border-(--vscode-panel-border)">
          <div className="flex items-center gap-2 px-4 py-2">
            <h2 className="min-w-0 flex-1 truncate font-semibold">Logs: {containers.find((container) => container.id === logs.id)?.name ?? logs.id}</h2>
            <Button variant="ghost" size="sm" aria-label="Close logs" title="Close logs" prefix={<Icon name="close" />} onClick={() => setLogs(undefined)} />
          </div>
          <pre className="min-h-0 overflow-auto whitespace-pre-wrap break-all px-4 pb-4 select-text">{logs.text || 'No logs.'}</pre>
        </section>
      )}
    </main>
  );
}

function App() {
  const state = useHostData<ContainerEditorData>();
  if (state.status !== 'loaded') return <main className="p-4">{state.status === 'loading' ? <Loading label="Loading containers..." /> : <ErrorMessage message={state.message} />}</main>;
  return <ContainerList data={state.data} />;
}

mountWebview('root', <App />);
