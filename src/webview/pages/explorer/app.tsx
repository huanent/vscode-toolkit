import { useState } from 'react';
import type { ExplorerEntry, ExplorerWebviewMessage } from '@/features/explorer/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Empty } from '@/webview/components/empty';
import { ErrorMessage } from '@/webview/components/error-message';
import { Loading } from '@/webview/components/loading';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import { ExplorerToolbar, type ExplorerViewMode } from '@/webview/pages/explorer/components/explorer-toolbar';
import { FileGridView } from '@/webview/pages/explorer/components/file-grid-view';
import { FileListView } from '@/webview/pages/explorer/components/file-list-view';
import {
  type ExplorerLocation,
  formatAddress,
  getAddressSegments,
  indexEntries,
  resolveAddress,
  sortEntries,
} from '@/webview/pages/explorer/explorer-location';
import '@/webview/styles.css';

function App() {
  const [location, setLocation] = useState<ExplorerLocation>(null);
  const [history, setHistory] = useState<ExplorerLocation[]>([]);
  const [viewMode, setViewMode] = useState<ExplorerViewMode>('list');
  const state = useHostData<ExplorerEntry[]>();

  if (state.status === 'error') {
    return (
      <main className="p-2">
        <ErrorMessage message={state.message} />
      </main>
    );
  }

  if (state.status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-(--vscode-editor-background) p-4 text-(--vscode-foreground)">
        <Loading label="Reading workspace files..." />
      </main>
    );
  }

  const entries = state.data;
  if (!entries.length) {
    return (
      <main className="grid min-h-screen place-items-center bg-(--vscode-editor-background) text-(--vscode-foreground)">
        <Empty
          title="No workspace folder"
          description="Open a folder or workspace to browse its files."
          icon="folder-opened"
        />
      </main>
    );
  }

  // A single workspace folder is the top level itself; multi-root workspaces keep folders as the top level.
  const defaultLocation: ExplorerLocation = entries.length === 1 ? (entries[0]?.id ?? null) : null;
  const effectiveLocation = location ?? defaultLocation;
  const index = indexEntries(entries);
  const folder = effectiveLocation === null ? null : (index.get(effectiveLocation) ?? null);
  const currentLocation = folder?.id ?? null;
  const children = sortEntries(folder ? (folder.children ?? []) : entries);

  const navigate = (next: ExplorerLocation) => {
    const target = next ?? defaultLocation;
    if (target === currentLocation) return;
    setHistory((previous) => [...previous, currentLocation]);
    setLocation(target);
  };

  const goBack = () => {
    if (!history.length) return;
    setLocation(history[history.length - 1] ?? null);
    setHistory(history.slice(0, -1));
  };

  const openEntry = (entry: ExplorerEntry) => {
    if (entry.type === 'directory') navigate(entry.id);
    else postToHost({ type: 'openFile', uri: entry.uri } satisfies ExplorerWebviewMessage);
  };

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
      <ExplorerToolbar
        address={formatAddress(index, currentLocation)}
        addressSegments={getAddressSegments(index, currentLocation)}
        canGoBack={history.length > 0}
        viewMode={viewMode}
        onBack={goBack}
        onAddressSubmit={(address) => {
          const target = resolveAddress(index, address);
          if (target === undefined) return false;
          navigate(target);
          return true;
        }}
        onNavigate={navigate}
        onViewModeChange={setViewMode}
      />
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="Files">
        {children.length === 0 ? (
          <Empty title="Empty folder" description="This folder has no files." icon="folder" />
        ) : viewMode === 'list' ? (
          <FileListView entries={children} onOpen={openEntry} />
        ) : (
          <FileGridView entries={children} onOpen={openEntry} />
        )}
      </section>
    </main>
  );
}

mountWebview('root', <App />);
