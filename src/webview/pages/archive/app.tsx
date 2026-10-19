import { useEffect, useState } from 'react';
import type { ArchiveTreeEntry } from '@/features/archive/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { ArchiveTree } from '@/webview/components/archive-tree';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Loading } from '@/webview/components/ui/loading';
import { getRootData, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function App() {
  const state = useHostData<ArchiveTreeEntry[]>();
  const name = getRootData('name') ?? 'Archive';
  const [collapseAllTrigger, setCollapseAllTrigger] = useState(0);

  useEffect(() => {
    document.title = name;
  }, [name]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'collapseAll') setCollapseAllTrigger((value) => value + 1);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (state.status === 'loaded') {
    return (
      <main className="flex h-dvh min-w-0 flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
        <div className="min-h-0 flex-1 overflow-auto p-2">
          <ArchiveTree entries={state.data} name={name} collapseAllTrigger={collapseAllTrigger} />
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-(--vscode-editor-background) p-4 text-(--vscode-foreground)">
      {state.status === 'loading' ? <Loading label="Reading archive..." /> : <ErrorMessage message={state.message} />}
    </main>
  );
}

mountWebview('root', <App />);
