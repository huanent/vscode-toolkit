import { useEffect, useState } from 'react';
import type { ArchiveTreeEntry } from '@/features/archive/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Empty } from '@/webview/components/empty';
import { Loading } from '@/webview/components/loading';
import { Tree, type TreeItem } from '@/webview/components/tree';
import { getRootData, useHostData } from '@/webview/utils/host-data';
import { formatSize } from '@/webview/utils/format';
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
      <main className="flex min-h-screen flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {state.data.length ? (
            <Tree
              ariaLabel={`${name} contents`}
              collapseAllTrigger={collapseAllTrigger}
              items={toArchiveTreeItems(state.data)}
            />
          ) : (
            <Empty
              label="Empty archive"
              title="Archive is empty"
              description="This archive contains no files or directories."
              icon="∅"
            />
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-(--vscode-editor-background) p-4 text-(--vscode-foreground)">
      {state.status === 'loading' ? (
        <Loading label="Reading archive..." />
      ) : (
        <p className="max-w-lg text-center text-(--vscode-errorForeground)" role="alert">
          {state.message}
        </p>
      )}
    </main>
  );
}

function toArchiveTreeItems(entries: readonly ArchiveTreeEntry[], parentPath = ''): TreeItem[] {
  return entries.map((entry) => {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    return entry.type === 'directory'
      ? {
          path,
          name: entry.name,
          type: 'directory' as const,
          children: entry.children ? toArchiveTreeItems(entry.children, path) : undefined,
        }
      : { path, name: entry.name, type: 'file' as const, detail: formatSize(entry.size) };
  });
}

mountWebview('root', <App />);
