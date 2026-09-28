import { useEffect, useState } from 'react';
import type { ArchiveTreeEntry } from '@/features/archive/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { DisclosureIcon, FileIcon, FolderIcon } from '@/webview/components/icons';
import { Empty } from '@/webview/components/empty';
import { Loading } from '@/webview/components/loading';
import { Tree } from '@/webview/components/tree';
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
      <main className="flex min-h-screen flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {state.data.length ? (
            <Tree
              ariaLabel={`${name} contents`}
              collapseAllTrigger={collapseAllTrigger}
              items={state.data}
              getChildren={(entry) => entry.children ?? []}
              getKey={getArchiveEntryPath}
              getLabel={(entry) => entry.name}
              isBranch={(entry) => entry.type === 'directory'}
              renderExpandIcon={(expanded) => <DisclosureIcon expanded={expanded} size="lg" />}
              renderItem={(entry, { expanded, path }) => (
                <>
                  {entry.type === 'file' ? <FileIcon size="lg" /> : <FolderIcon expanded={expanded} size="lg" />}
                  <span
                    className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                    title={getArchiveEntryPath(path)}
                  >
                    {entry.name}
                  </span>
                  <span className="w-20 shrink-0 overflow-hidden text-right text-xs text-ellipsis whitespace-nowrap text-(--vscode-descriptionForeground)">
                    {entry.type === 'file' ? formatSize(entry.size) : ''}
                  </span>
                </>
              )}
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

function getArchiveEntryPath(path: readonly ArchiveTreeEntry[]): string {
  return path.map((entry) => entry.name).join('/');
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size;
  let unitIndex = -1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

mountWebview('root', <App />);
