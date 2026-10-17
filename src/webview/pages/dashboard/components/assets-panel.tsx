import type { AssetRequest, AssetTreeEntry } from '@/features/assets/protocol';
import { Button } from '@/webview/components/ui/button';
import { Empty } from '@/webview/components/ui/empty';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Icon } from '@/webview/components/ui/icons';
import { Loading } from '@/webview/components/ui/loading';
import { Tree, type TreeFileItem } from '@/webview/components/ui/tree';
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
            onActivate={activateAsset}
            onItemDoubleClick={activateAsset}
            renderActions={(item) => {
              const request = toAssetRequest(item);
              if (!request) return null;
              const label = request.action === 'preview' ? 'Preview' : 'Connect';
              return (
                <>
                  {item.context?.assetType === 'ssh' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Open SFTP"
                      title="Open SFTP"
                      prefix={<Icon name="folder" />}
                      onClick={() => postToHost({ ...request, action: 'sftp' } satisfies AssetRequest)}
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={label}
                    title={label}
                    prefix={<Icon name="play" />}
                    onClick={() => activateAsset(item)}
                  />
                </>
              );
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

function activateAsset(item: TreeFileItem) {
  const request = toAssetRequest(item);
  if (request) postToHost(request);
}

function toAssetRequest(item: TreeFileItem): AssetRequest | undefined {
  const context = item.context;
  if (!context) return undefined;
  return {
    type: 'assetAction',
    action: context.assetTable ? 'preview' : 'connect',
    id: String(context.assetId),
    database: typeof context.assetDatabase === 'string' ? context.assetDatabase : undefined,
    table: typeof context.assetTable === 'string' ? context.assetTable : undefined,
  };
}
