import { Empty } from '@/webview/components/empty';
import { ErrorMessage } from '@/webview/components/error-message';
import { Loading } from '@/webview/components/loading';
import { Tree, type TreeItem } from '@/webview/components/tree';
import type { OpenTempFileRequest, TempTreeEntry } from '@/features/temp/protocol';
import { postToHost } from '@/webview/utils/host-data';

type TempPanelProps = {
  entries: TempTreeEntry[] | undefined;
  error: string | undefined;
  loading: boolean;
};

const panelContext = JSON.stringify({ webviewSection: 'temp', preventDefaultContextMenuItems: true });

export function TempPanel({ entries, error, loading }: TempPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col" data-vscode-context={panelContext}>
      {error && !entries ? (
        <ErrorMessage message={error} />
      ) : loading ? (
        <Loading label="Reading temporary files..." />
      ) : entries?.length ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <Tree
            ariaLabel="Temporary files"
            items={toTempTreeItems(entries)}
            onActivate={(item) => {
              if (item.type === 'file') {
                postToHost({ type: 'openTempFile', path: item.path } satisfies OpenTempFileRequest);
              }
            }}
          />
        </div>
      ) : (
        <Empty title="No temporary files" description="The temp directory is empty." icon="history" />
      )}

      {error && entries ? <ErrorMessage message={error} className="mt-2" /> : null}
    </section>
  );
}

function toTempTreeItems(entries: readonly TempTreeEntry[], parentPath = ''): TreeItem[] {
  return entries.map((entry) => {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    const context = { tempEntryPath: path, tempEntryType: entry.type };
    return entry.type === 'directory'
      ? {
          path,
          name: entry.name,
          type: 'directory' as const,
          context,
          children: entry.children ? toTempTreeItems(entry.children, path) : undefined,
        }
      : { path, name: entry.name, type: 'file' as const, context };
  });
}
