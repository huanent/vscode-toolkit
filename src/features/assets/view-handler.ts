import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import type { AssetRequest, AssetsMessage, AssetViewEntry } from './protocol';
import type { AssetProvider } from './asset-provider';
import type { AssetService } from './service';

export function createAssetsView(
  context: vscode.ExtensionContext,
  service: AssetService,
  providers: readonly AssetProvider[],
): WebviewViewHandler {
  let activeWebview: vscode.Webview | undefined;
  const providerFor = (type: string) => {
    const provider = providers.find((candidate) => candidate.type === type);
    if (!provider) throw new Error(`Unsupported asset type: ${type}`);
    return provider;
  };
  const list = async (): Promise<AssetViewEntry[]> =>
    (await service.list()).map((asset) => providerFor(asset.type).toViewEntry(asset));
  const refresh = async () => {
    const webview = activeWebview;
    const entries = await list();
    if (webview && webview === activeWebview)
      await webview.postMessage({ type: 'assetsUpdated', entries } satisfies AssetsMessage);
  };
  const act = async (request: AssetRequest) => {
    try {
      if (request.action === 'add') {
        const selected = request.assetType
          ? providerFor(request.assetType)
          : await vscode.window.showQuickPick(
              providers.map((provider) => ({ label: provider.label, provider })),
              { title: 'Asset type' },
            );
        const provider = selected && ('provider' in selected ? selected.provider : selected);
        if (provider && (await provider.configure())) await refresh();
        return;
      }
      if (!request.id) return;
      const asset = await service.get(request.id);
      const provider = providerFor(asset.type);
      if (request.action === 'edit') {
        if (!(await provider.configure(asset))) return;
      } else if (request.action === 'delete') {
        if (
          (await vscode.window.showWarningMessage(`Delete asset "${asset.name}"?`, { modal: true }, 'Delete')) !==
          'Delete'
        )
          return;
        await service.delete(asset);
        provider.invalidate(asset.id);
      } else {
        await provider.execute(asset, request);
      }
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await activeWebview?.postMessage({ type: 'assetError', message } satisfies AssetsMessage);
      await vscode.window.showErrorMessage(message);
    }
  };
  for (const action of ['add', 'edit', 'delete', 'connect', 'disconnect', 'query'] as const) {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        `toolkit.assets.${action}`,
        (argument?: { assetId?: string; assetDatabase?: string; assetType?: string }) =>
          act({
            type: 'assetAction',
            action,
            id: argument?.assetId,
            database: argument?.assetDatabase,
            assetType: argument?.assetType,
          }),
      ),
    );
  }
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('toolkit.storagePath')) {
        for (const provider of providers) provider.invalidate();
        void refresh().catch((error: unknown) => vscode.window.showErrorMessage(String(error)));
      }
    }),
  );
  return {
    load: list,
    onResolve: (webview) => {
      activeWebview = webview;
    },
    onDispose: () => {
      activeWebview = undefined;
    },
    onMessage: async (message) => {
      if (isAssetRequest(message)) await act(message);
    },
  };
}

function isAssetRequest(value: unknown): value is AssetRequest {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<AssetRequest>;
  return (
    message.type === 'assetAction' &&
    typeof message.action === 'string' &&
    ['add', 'edit', 'delete', 'connect', 'disconnect', 'query', 'preview'].includes(message.action) &&
    [message.id, message.database, message.table, message.assetType].every(
      (field) => field === undefined || typeof field === 'string',
    )
  );
}
