import * as vscode from 'vscode';
import type { WebviewViewHandler } from '@/host/webview-view-provider';
import type { AssetRequest, AssetsMessage, AssetTreeEntry, AssetViewEntry } from './protocol';
import type { AssetProvider } from './asset-provider';
import { isAiEnabled, type AssetService } from './service';
import { openAssetEditor } from './editor';
import type { CredentialService } from '@/features/credential/service';
import { showFolderPicker } from '@/host/utils/folder-picker';

export interface AssetsViewHandler extends WebviewViewHandler {
  refresh(): Promise<void>;
}

export function createAssetsView(
  context: vscode.ExtensionContext,
  service: AssetService,
  providers: readonly AssetProvider[],
  credentials: CredentialService,
): AssetsViewHandler {
  let activeWebview: vscode.Webview | undefined;
  const providerFor = (type: string) => {
    const provider = providers.find((candidate) => candidate.type === type);
    if (!provider) throw new Error(`Unsupported asset type: ${type}`);
    return provider;
  };
  const list = async (): Promise<AssetTreeEntry[]> => {
    const [assets, folders] = await Promise.all([service.list(), service.listFolders()]);
    const entries = assets.map((asset) => {
      const provider = providerFor(asset.type);
      const entry = provider.toViewEntry(asset);
      const hostContext: Record<string, string | number | boolean> =
        'host' in asset && typeof asset.host === 'string' ? { assetHost: asset.host } : {};
      return {
        ...entry,
        icon: provider.icon,
        path: asset.folder ? `${asset.folder}/${entry.path}` : entry.path,
        context: {
          ...entry.context,
          ...(asset.folder ? { assetFolderPath: asset.folder } : {}),
          ...(isAiEnabled(asset) ? { assetAiEnabled: true } : {}),
          ...hostContext,
        },
      };
    });
    return buildAssetTree(entries, folders);
  };
  const refresh = async () => {
    const webview = activeWebview;
    const entries = await list();
    if (webview && webview === activeWebview)
      await webview.postMessage({ type: 'assetsUpdated', entries } satisfies AssetsMessage);
  };
  const createFolder = async (target: unknown) => {
    const parentFolder =
      target && typeof target === 'object' && 'assetFolderPath' in target && typeof target.assetFolderPath === 'string'
        ? target.assetFolderPath
        : undefined;
    const name = await vscode.window.showInputBox({
      prompt: 'Folder name',
      placeHolder: 'databases',
      validateInput: (value) =>
        !value.trim() || value === '.' || value === '..' || /[\\/\0]/.test(value)
          ? 'Enter a valid folder name.'
          : undefined,
    });
    if (name === undefined) return;
    await service.createFolder(name, parentFolder);
    await refresh();
  };
  const moveEntry = async (target: unknown) => {
    const value = target && typeof target === 'object' ? (target as Record<string, unknown>) : {};
    const assetId = typeof value.assetId === 'string' ? value.assetId : undefined;
    const folderPath = typeof value.assetFolderPath === 'string' ? value.assetFolderPath : undefined;
    if (!assetId && !folderPath) return;

    const folders = await service.listFolders();
    const isFolder = !assetId && Boolean(folderPath);
    const destinations = folders.filter(
      (folder) => !isFolder || (folder !== folderPath && !folder.startsWith(`${folderPath}/`)),
    );
    const selected = await showFolderPicker(destinations);
    if (!selected) return;

    if (assetId) await service.moveAsset(assetId, selected.folderPath);
    else if (folderPath) await service.moveFolder(folderPath, selected.folderPath);
    await refresh();
  };
  const renameFolder = async (folderPath: string) => {
    const currentName = folderPath.slice(folderPath.lastIndexOf('/') + 1);
    const name = await vscode.window.showInputBox({
      prompt: 'Rename folder',
      value: currentName,
      valueSelection: [0, currentName.length],
      validateInput: (value) =>
        !value.trim() || value === '.' || value === '..' || /[\\/\0]/.test(value)
          ? 'Enter a valid folder name.'
          : undefined,
    });
    if (name === undefined) return;
    await service.renameFolder(folderPath, name);
    await refresh();
  };
  const deleteFolder = async (folderPath: string) => {
    const name = folderPath.slice(folderPath.lastIndexOf('/') + 1);
    const confirmation = await vscode.window.showWarningMessage(
      `Delete folder "${name}" and all its contents?`,
      { modal: true },
      'Delete',
    );
    if (confirmation !== 'Delete') return;
    const assets = await service.deleteFolder(folderPath);
    for (const asset of assets) providerFor(asset.type).invalidate(asset.id);
    await refresh();
  };
  const copyAiReference = async (id: string) => {
    const asset = await service.get(id);
    const path = asset.folder ? `${asset.folder}/${asset.name}` : asset.name;
    await vscode.env.clipboard.writeText(`[Asset "${path}", id: ${asset.id}, type: ${asset.type}]`);
    void vscode.window.setStatusBarMessage('AI reference copied to clipboard', 2000);
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
        if (provider) openAssetEditor(context, service, provider, refresh, credentials, undefined, request.folder);
        return;
      }
      if (!request.id) return;
      const asset = await service.get(request.id);
      if (request.action === 'edit') {
        openAssetEditor(context, service, providerFor(asset.type), refresh, credentials, asset);
        return;
      } else if (request.action === 'delete') {
        if (
          (await vscode.window.showWarningMessage(`Delete asset "${asset.name}"?`, { modal: true }, 'Delete')) !==
          'Delete'
        )
          return;
        await service.delete(asset);
        providerFor(asset.type).invalidate(asset.id);
      } else if (request.action === 'duplicate') {
        const draft = { ...asset, name: await service.copyName(asset) };
        openAssetEditor(
          context,
          service,
          providerFor(asset.type),
          refresh,
          credentials,
          undefined,
          asset.folder,
          draft,
        );
        return;
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
  for (const action of ['add', 'edit', 'duplicate', 'query'] as const) {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        `toolkit.assets.${action}`,
        (argument?: { assetId?: string; assetDatabase?: string; assetType?: string; assetFolderPath?: string }) =>
          act({
            type: 'assetAction',
            action,
            id: argument?.assetId,
            database: argument?.assetDatabase,
            assetType: argument?.assetType,
            folder: argument?.assetFolderPath,
          }),
      ),
    );
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.assets.copyHost', async (argument?: { assetHost?: unknown }) => {
      if (typeof argument?.assetHost !== 'string') return;
      await vscode.env.clipboard.writeText(argument.assetHost);
      void vscode.window.setStatusBarMessage('Host copied to clipboard', 2000);
    }),
    vscode.commands.registerCommand('toolkit.assets.copyAiReference', (argument?: { assetId?: unknown }) => {
      if (typeof argument?.assetId !== 'string') return;
      return copyAiReference(argument.assetId).catch((error: unknown) =>
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error)),
      );
    }),
    vscode.commands.registerCommand('toolkit.assets.createFolder', (target: unknown) =>
      createFolder(target).catch((error: unknown) =>
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error)),
      ),
    ),
    vscode.commands.registerCommand('toolkit.assets.move', (target: unknown) =>
      moveEntry(target).catch((error: unknown) =>
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error)),
      ),
    ),
    vscode.commands.registerCommand('toolkit.assets.rename', (target?: { assetFolderPath?: unknown }) => {
      if (typeof target?.assetFolderPath !== 'string') return;
      return renameFolder(target.assetFolderPath).catch((error: unknown) =>
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error)),
      );
    }),
    vscode.commands.registerCommand(
      'toolkit.assets.delete',
      (target?: { assetId?: unknown; assetFolderPath?: unknown; assetType?: unknown; assetDatabase?: unknown }) => {
        if (typeof target?.assetId === 'string') {
          return act({
            type: 'assetAction',
            action: 'delete',
            id: target.assetId,
            assetType: typeof target.assetType === 'string' ? target.assetType : undefined,
            database: typeof target.assetDatabase === 'string' ? target.assetDatabase : undefined,
          });
        }
        if (typeof target?.assetFolderPath !== 'string') return;
        return deleteFolder(target.assetFolderPath).catch((error: unknown) =>
          vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error)),
        );
      },
    ),
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
    refresh,
  };
}

function buildAssetTree(entries: AssetViewEntry[], folders: string[]): AssetTreeEntry[] {
  const roots: AssetTreeEntry[] = [];
  const directories = new Map<string, Extract<AssetTreeEntry, { type: 'directory' }>>();

  const ensureDirectory = (folderPath: string): AssetTreeEntry[] => {
    let children = roots;
    let directoryPath = '';

    for (const name of folderPath.split('/').filter(Boolean)) {
      directoryPath = directoryPath ? `${directoryPath}/${name}` : name;
      let directory = directories.get(directoryPath);
      if (!directory) {
        directory = {
          path: directoryPath,
          name,
          type: 'directory',
          children: [],
          context: { webviewSection: 'assets', assetFolderPath: directoryPath },
        };
        directories.set(directoryPath, directory);
        children.push(directory);
      }
      children = directory.children;
    }
    return children;
  };

  for (const folder of folders) ensureDirectory(folder);
  for (const entry of entries) {
    const segments = entry.path.split('/').filter(Boolean);
    const parentPath = segments.slice(0, -1).join('/');
    ensureDirectory(parentPath).push(entry);
  }

  return roots;
}

function isAssetRequest(value: unknown): value is AssetRequest {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<AssetRequest>;
  return (
    message.type === 'assetAction' &&
    typeof message.action === 'string' &&
    ['add', 'edit', 'delete', 'duplicate', 'connect', 'query', 'preview'].includes(message.action) &&
    [message.id, message.database, message.table, message.assetType, message.folder].every(
      (field) => field === undefined || typeof field === 'string',
    )
  );
}
