import { useState } from 'react';
import type { ExplorerDirectory, ExplorerEntry, ExplorerWebviewMessage } from '@/features/explorer/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Empty } from '@/webview/components/empty';
import { ErrorMessage } from '@/webview/components/error-message';
import { Loading } from '@/webview/components/loading';
import { getRootData, postToHost, useHostData } from '@/webview/utils/host-data';
import { ExplorerToolbar, type ExplorerViewMode } from '@/webview/pages/explorer/components/explorer-toolbar';
import { FileGridView } from '@/webview/pages/explorer/components/file-grid-view';
import { FileListView } from '@/webview/pages/explorer/components/file-list-view';
import {
  formatAddress,
  getAddressSegments,
  indexEntries,
  sortEntries,
} from '@/webview/pages/explorer/explorer-location';
import '@/webview/styles.css';

function App() {
  const [viewMode, setViewMode] = useState<ExplorerViewMode>(() =>
    getRootData('viewMode') === 'grid' ? 'grid' : 'list',
  );
  const state = useHostData<ExplorerDirectory>();

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

  const { entries, ancestors, location, canGoBack, hasWorkspace } = state.data;
  if (!hasWorkspace) {
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

  const index = indexEntries(ancestors);
  const children = sortEntries(entries);
  const navigate = (uri: string | null) => {
    if (uri !== location) postToHost({ type: 'readDirectory', uri } satisfies ExplorerWebviewMessage);
  };

  const openEntry = (entry: ExplorerEntry) => {
    if (entry.type === 'directory') navigate(entry.id);
    else postToHost({ type: 'openFile', uri: entry.uri } satisfies ExplorerWebviewMessage);
  };

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
      <ExplorerToolbar
        address={formatAddress(index, location)}
        addressSegments={getAddressSegments(index, location)}
        canGoBack={canGoBack}
        viewMode={viewMode}
        onBack={() => postToHost({ type: 'goBack' } satisfies ExplorerWebviewMessage)}
        onAddressSubmit={(address) => {
          postToHost({ type: 'navigateAddress', address } satisfies ExplorerWebviewMessage);
          return true;
        }}
        onNavigate={navigate}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          postToHost({ type: 'setViewMode', mode } satisfies ExplorerWebviewMessage);
        }}
      />
      {state.error && <ErrorMessage message={state.error} />}
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
