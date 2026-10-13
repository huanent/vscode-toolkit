import type { ExplorerEntry, ExplorerWebviewMessage } from '@/features/explorer/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Empty } from '@/webview/components/empty';
import { ErrorMessage } from '@/webview/components/error-message';
import { Loading } from '@/webview/components/loading';
import { Tree, type TreeItem } from '@/webview/components/tree';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function App() {
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

  const fileUris = collectFileUris(entries);

  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-(--vscode-editor-background) text-(--vscode-foreground)">
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <Tree
          ariaLabel="Workspace files"
          items={toTreeItems(entries)}
          onActivate={(item) => {
            const uri = fileUris.get(item.path);
            if (uri) postToHost({ type: 'openFile', uri } satisfies ExplorerWebviewMessage);
          }}
        />
      </div>
    </main>
  );
}

function toTreeItems(entries: readonly ExplorerEntry[]): TreeItem[] {
  return entries.map((entry) =>
    entry.type === 'directory'
      ? {
          path: entry.id,
          name: entry.name,
          type: 'directory' as const,
          children: toTreeItems(entry.children ?? []),
        }
      : { path: entry.id, name: entry.name, type: 'file' as const },
  );
}

function collectFileUris(entries: readonly ExplorerEntry[], uris = new Map<string, string>()): Map<string, string> {
  for (const entry of entries) {
    if (entry.type === 'file') uris.set(entry.id, entry.uri);
    else collectFileUris(entry.children ?? [], uris);
  }
  return uris;
}

mountWebview('root', <App />);
