import type { AssetRequest, AssetViewEntry } from '@/features/assets/protocol';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Loading } from '@/webview/components/loading';
import { Tree, type TreeItem } from '@/webview/components/tree';
import { postToHost } from '@/webview/utils/host-data';

const panelContext = JSON.stringify({ webviewSection: 'assets', preventDefaultContextMenuItems: true });

export function AssetsPanel({
  entries,
  loading,
  error,
}: {
  entries: AssetViewEntry[] | undefined;
  loading: boolean;
  error: string | undefined;
}) {
  return (
    <section className="flex min-h-64 min-w-0 flex-col" data-vscode-context={panelContext}>
      <div className="mb-1 flex justify-end">
        <Button
          variant="ghost"
          title="Add asset"
          aria-label="Add asset"
          icon={<Icon name="add" />}
          onClick={() => postToHost({ type: 'assetAction', action: 'add' } satisfies AssetRequest)}
        />
      </div>
      {loading ? (
        <Loading label="Reading assets..." />
      ) : entries?.length ? (
        <Tree
          ariaLabel="Assets"
          items={toTreeItems(entries)}
          onActivate={(item) => {
            const context = item.context;
            if (!context) return;
            postToHost({
              type: 'assetAction',
              action: context.assetTable ? 'preview' : 'connect',
              id: String(context.assetId),
              database: typeof context.assetDatabase === 'string' ? context.assetDatabase : undefined,
              table: typeof context.assetTable === 'string' ? context.assetTable : undefined,
            } satisfies AssetRequest);
          }}
        />
      ) : (
        <p className="p-2 text-sm text-(--vscode-descriptionForeground)">No assets</p>
      )}
      {error && (
        <p className="mt-2 wrap-break-word text-sm text-(--vscode-errorForeground)" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function toTreeItems(entries: AssetViewEntry[]): TreeItem[] {
  return entries.map((entry) =>
    entry.type === 'directory'
      ? { ...entry, type: 'directory', children: entry.children ? toTreeItems(entry.children) : undefined }
      : { ...entry, type: 'file' },
  );
}
