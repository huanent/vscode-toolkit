import type { AssetRequest, AssetTreeEntry } from '@/features/assets/protocol';
import { Empty } from '@/webview/components/empty';
import { ErrorMessage } from '@/webview/components/error-message';
import { Loading } from '@/webview/components/loading';
import { Tree } from '@/webview/components/tree';
import { postToHost } from '@/webview/utils/host-data';

const panelContext = JSON.stringify({ webviewSection: 'assets', preventDefaultContextMenuItems: true });

export function AssetsPanel({
  entries,
  loading,
  error,
  collapseAllTrigger,
}: {
  entries: AssetTreeEntry[] | undefined;
  loading: boolean;
  error: string | undefined;
  collapseAllTrigger: number;
}) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col" data-vscode-context={panelContext}>
      {loading ? (
        <Loading label="Reading assets..." />
      ) : entries?.length ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <Tree
            ariaLabel="Assets"
            collapseAllTrigger={collapseAllTrigger}
            items={entries}
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
        </div>
      ) : (
        <Empty title="No assets" description="The assets list is empty." icon="layers" />
      )}
      {error && <ErrorMessage message={error} className="mt-2" />}
    </section>
  );
}
