import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import type { AssetRequest, AssetsMessage, AssetViewEntry } from './protocol';
import type { AssetProvider } from './asset-provider';
import type { AssetService } from './service';
import { openAssetEditor } from './editor';

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
  const list = async (): Promise<AssetViewEntry[]> => {
    const assets = await service.list();
    const folders = new Map<string, AssetViewEntry>();
    for (const asset of assets) {
      if (asset.type === 'folder')
        folders.set(asset.id, {
          path: asset.id,
          name: asset.name,
          type: 'directory',
          context: { assetFolderId: asset.id },
          children: [],
        });
    }
    const entries: AssetViewEntry[] = [];
    for (const asset of assets) {
      const entry = folders.get(asset.id) ?? providerFor(asset.type).toViewEntry(asset);
      const parent = asset.parentId ? folders.get(asset.parentId) : undefined;
      if (parent) parent.children!.push(entry);
      else entries.push(entry);
    }
    const updatePaths = (nodes: AssetViewEntry[], parentPath = '') => {
      for (const entry of nodes) {
        entry.path = parentPath ? `${parentPath}/${entry.path}` : entry.path;
        if (entry.children) updatePaths(entry.children, entry.path);
      }
    };
    updatePaths(entries);
    return entries;
  };
  const refresh = async () => {
    const webview = activeWebview;
    const entries = await list();
    if (webview && webview === activeWebview)
      await webview.postMessage({ type: 'assetsUpdated', entries } satisfies AssetsMessage);
  };
  const act = async (request: AssetRequest) => {
    try {
      if (request.action === 'createFolder') {
        const name = await vscode.window.showInputBox({ title: 'New asset folder', prompt: 'Folder name' });
        if (name === undefined) return;
        await service.createFolder(name, request.folderId);
        await refresh();
        return;
      }
      if (request.action === 'add') {
        const selected = request.assetType
          ? providerFor(request.assetType)
          : await vscode.window.showQuickPick(
              providers.map((provider) => ({ label: provider.label, provider })),
              { title: 'Asset type' },
            );
        const provider = selected && ('provider' in selected ? selected.provider : selected);
        if (provider) openAssetEditor(context, service, provider, refresh, undefined, request.folderId);
        return;
      }
      if (!request.id) return;
      const asset = await service.get(request.id);
      if (request.action === 'edit') {
        openAssetEditor(context, service, providerFor(asset.type), refresh, asset);
        return;
      } else if (request.action === 'delete') {
        const isFolder = asset.type === 'folder';
        if (
          (await vscode.window.showWarningMessage(
            `Delete ${isFolder ? 'asset folder' : 'asset'} "${asset.name}"?`,
            { modal: true, detail: isFolder ? 'The folder and all assets inside it will be deleted.' : undefined },
            'Delete',
          )) !== 'Delete'
        )
          return;
        await service.delete(asset);
        if (isFolder) for (const provider of providers) provider.invalidate();
        else providerFor(asset.type).invalidate(asset.id);
      } else {
        await providerFor(asset.type).execute(asset, request);
      }
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await activeWebview?.postMessage({ type: 'assetError', message } satisfies AssetsMessage);
      await vscode.window.showErrorMessage(message);
    }
  };
  for (const action of ['add', 'createFolder', 'edit', 'delete', 'connect', 'disconnect', 'query'] as const) {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        `toolkit.assets.${action}`,
        (argument?: { assetId?: string; assetDatabase?: string; assetType?: string; assetFolderId?: string }) =>
          act({
            type: 'assetAction',
            action,
            id: argument?.assetId ?? argument?.assetFolderId,
            database: argument?.assetDatabase,
            assetType: argument?.assetType,
            folderId: argument?.assetFolderId,
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
    ['add', 'createFolder', 'edit', 'delete', 'connect', 'disconnect', 'query', 'preview'].includes(message.action) &&
    [message.id, message.database, message.table, message.assetType, message.folderId].every(
      (field) => field === undefined || typeof field === 'string',
    )
  );
}
