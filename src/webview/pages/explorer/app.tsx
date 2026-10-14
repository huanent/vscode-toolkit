import { useState } from 'react';
import type { ExplorerDirectory, ExplorerEntry, ExplorerWebviewMessage } from '@/features/explorer/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Empty } from '@/webview/components/empty';
import { ErrorMessage } from '@/webview/components/error-message';
import { DataGrid } from '@/webview/components/data-grid';
import { DataList, type DataListColumn } from '@/webview/components/data-list';
import { Icon } from '@/webview/components/icons';
import { IconLabel } from '@/webview/components/icon-label';
import { Loading } from '@/webview/components/loading';
import { formatDateTime, formatSize } from '@/webview/utils/format';
import { getRootData, postToHost, useHostData } from '@/webview/utils/host-data';
import { ExplorerToolbar, type ExplorerViewMode } from '@/webview/pages/explorer/components/explorer-toolbar';
import {
  formatAddress,
  getAddressSegments,
  indexEntries,
  sortEntries,
} from '@/webview/pages/explorer/explorer-location';
import '@/webview/styles.css';

const columns: DataListColumn<ExplorerEntry>[] = [
  {
    key: 'name',
    header: 'Name',
    className: 'flex-1',
    headerClassName: 'pl-5',
    cell: (entry) => <IconLabel icon={entry.type === 'directory' ? 'folder' : 'file'} label={entry.name} />,
  },
  {
    key: 'modified',
    header: 'Modified',
    className: 'w-36 shrink-0 whitespace-nowrap',
    align: 'left',
    cell: (entry) => (
      <div className="text-(--vscode-descriptionForeground)">
        {entry.modifiedAt === undefined ? '—' : formatDateTime(entry.modifiedAt)}
      </div>
    ),
  },
  {
    key: 'created',
    header: 'Created',
    className: 'w-36 shrink-0 whitespace-nowrap',
    align: 'left',
    cell: (entry) => (
      <div className="text-(--vscode-descriptionForeground)">
        {entry.createdAt === undefined ? '—' : formatDateTime(entry.createdAt)}
      </div>
    ),
  },
  {
    key: 'size',
    header: 'Size',
    className: 'w-14 shrink-0 whitespace-nowrap',
    align: 'right',
    cell: (entry) => (
      <div className="text-(--vscode-descriptionForeground)">
        {entry.size === undefined ? '—' : formatSize(entry.size)}
      </div>
    ),
  },
];

function describeEntry(entry: ExplorerEntry): string {
  return [
    entry.name,
    entry.modifiedAt === undefined ? undefined : `Modified: ${formatDateTime(entry.modifiedAt)}`,
    entry.createdAt === undefined ? undefined : `Created: ${formatDateTime(entry.createdAt)}`,
    entry.size === undefined ? undefined : `Size: ${formatSize(entry.size)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

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
        favorites={state.data.favorites ?? []}
        onToggleFavorite={(address) => postToHost({ type: 'toggleFavorite', address } satisfies ExplorerWebviewMessage)}
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
          <DataList
            ariaLabel="Files"
            entries={children}
            columns={columns}
            entryKey={(entry) => entry.id}
            onOpen={openEntry}
          />
        ) : (
          <DataGrid
            ariaLabel="Files"
            entries={children}
            entryKey={(entry) => entry.id}
            label={(entry) => entry.name}
            icon={(entry) => <Icon name={entry.type === 'directory' ? 'folder' : 'file'} size="3xl" />}
            title={describeEntry}
            onOpen={openEntry}
          />
        )}
      </section>
    </main>
  );
}

mountWebview('root', <App />);
