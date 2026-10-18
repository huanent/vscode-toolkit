import { basename, posix } from 'node:path';
import * as vscode from 'vscode';
import type { AssetService } from '@/features/assets/service';
import type { SshService } from '@/features/ssh/ssh-service';
import { serveWebviewData } from '@/host/webview-bridge';
import { getWebviewHtml } from '@/host/webview-html';
import { formatTabTitle } from '@/shared/tab-title';
import { SftpFileService } from './file-service';
import { registerSftpFileSystem } from './file-system';
import type { SftpEditorData, SftpRequest, SftpSide, SshConnectionConfiguration } from '@/features/ssh/protocol';

export function registerSftpEditor(context: vscode.ExtensionContext, ssh: SshService, assets: AssetService): void {
  registerSftpFileSystem(context, ssh);
  const panels = new Map<string, vscode.WebviewPanel>();
  const handlers = new Map<string, (request: SftpRequest) => Promise<void>>();
  for (const action of ['upload', 'download', 'rename', 'delete'] as const) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`toolkit.sftp.${action}`, async (value: unknown) => {
        if (!value || typeof value !== 'object') return;
        const target = value as Record<string, unknown>;
        if (
          typeof target.sftpAssetId !== 'string' ||
          typeof target.sftpEntryPath !== 'string' ||
          (target.sftpSide !== 'local' && target.sftpSide !== 'remote')
        )
          return;
        if (
          (action === 'upload' && target.sftpSide !== 'local') ||
          (action === 'download' && target.sftpSide !== 'remote')
        )
          return;
        await handlers.get(target.sftpAssetId)?.({
          type: action === 'upload' || action === 'download' ? 'transfer' : action,
          side: target.sftpSide,
          path: target.sftpEntryPath,
        });
      }),
    );
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('toolkit.sftp.open', async (id: string) => {
      const asset = await assets.get(id);
      if (asset.type !== 'ssh') throw new Error('SFTP requires an SSH asset.');
      const existing = panels.get(asset.id);
      if (existing) {
        existing.reveal();
        return;
      }
      const panel = vscode.window.createWebviewPanel(
        'toolkit.sftp',
        formatTabTitle(`${asset.name} SFTP`, asset.folder),
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
        },
      );
      panels.set(asset.id, panel);
      context.subscriptions.push(panel);
      panel.iconPath = new vscode.ThemeIcon('files');
      const cancellation = new AbortController();
      const files = new SftpFileService(ssh, asset.id, cancellation.signal);
      const history: Record<SftpSide, string[]> = { local: [], remote: [] };
      let data: SftpEditorData | undefined;
      const busy: Record<SftpSide, boolean> = { local: false, remote: false };
      let disposed = false;
      const readFavorites = async () => {
        const current = (await assets.get(asset.id)) as SshConnectionConfiguration;
        return {
          local: context.globalState.get<string[]>('explorer.favorites', []),
          remote: current.sftpFavorites ?? [],
        };
      };
      const publish = async () => {
        if (!disposed && data) {
          data.favorites = await readFavorites();
          if (!disposed) await panel.webview.postMessage({ type: 'loaded', data: { ...data, busy } });
        }
      };
      const refresh = async (sides: SftpSide[]) => {
        if (!data) return;
        for (const side of sides) {
          const directory = await files.list(side, data[side]?.path);
          data[side] = { ...directory, canGoBack: history[side].length > 0 };
        }
      };
      const bridge = serveWebviewData<SftpEditorData>(panel.webview, async () => {
        if (data) return { ...data, busy };
        const local = await files.list(
          'local',
          vscode.workspace.workspaceFolders?.find((folder) => folder.uri.scheme === 'file')?.uri.fsPath,
        );
        busy.remote = true;
        data = { name: asset.name, local, busy, favorites: await readFavorites() };
        void files
          .list('remote')
          .then((remote) => {
            if (data) data.remote = remote;
          })
          .catch((error: unknown) => {
            if (data) data.error = error instanceof Error ? error.message : String(error);
          })
          .finally(() => {
            busy.remote = false;
            void publish();
          });
        return data;
      });
      const handleRequest = async (request: SftpRequest) => {
        if (
          !data ||
          !request ||
          typeof request !== 'object' ||
          !['toggleFavorite', 'navigate', 'back', 'refresh', 'create', 'rename', 'delete', 'open', 'transfer'].includes(
            request.type,
          )
        )
          return;
        if ('side' in request && request.side !== 'local' && request.side !== 'remote') return;
        const sides: SftpSide[] =
          request.type === 'refresh' || request.type === 'transfer' ? ['local', 'remote'] : [request.side];
        if (sides.some((side) => busy[side])) return;
        for (const side of sides) busy[side] = true;
        data.error = undefined;
        await publish();
        try {
          if (request.type === 'toggleFavorite') {
            if (typeof request.address !== 'string' || !request.address.trim()) return;
            const current = (await assets.get(asset.id)) as typeof asset & SshConnectionConfiguration;
            const favorites =
              request.side === 'local'
                ? context.globalState.get<string[]>('explorer.favorites', [])
                : (current.sftpFavorites ?? []);
            const next = favorites.includes(request.address)
              ? favorites.filter((address) => address !== request.address)
              : [...favorites, request.address];
            if (request.side === 'local') await context.globalState.update('explorer.favorites', next);
            else {
              current.sftpFavorites = next;
              await assets.save(current);
            }
            return;
          }
          if (request.type === 'refresh') {
            await refresh(sides);
            return;
          }
          const side = request.side;
          const directory = data[side];
          if (request.type === 'navigate' || request.type === 'back') {
            const path = request.type === 'back' ? history[side].at(-1) : request.path;
            if (typeof path !== 'string') return;
            const localPath =
              side === 'local' && process.platform === 'win32' && /^\/[a-zA-Z]:\//.test(path) ? path.slice(1) : path;
            const next = await files.list(side, localPath, directory?.path);
            if (request.type === 'back') history[side].pop();
            else if (directory && next.path !== directory.path) history[side].push(directory.path);
            data[side] = { ...next, canGoBack: history[side].length > 0 };
            return;
          }
          if (!directory) throw new Error('Connect to the remote directory first.');
          if (request.type === 'create') {
            const name = await askName(request.directory ? 'New folder' : 'New file');
            if (name) await files.create(side, files.child(side, directory.path, name), request.directory);
          } else {
            const entry = directory.entries.find((candidate) => candidate.path === request.path);
            if (!entry) throw new Error('The entry is no longer in this directory. Refresh and try again.');
            if (request.type === 'rename') {
              const name = await askName('Rename', entry.name);
              if (name && name !== entry.name) {
                if (directory.entries.some((candidate) => candidate.name === name))
                  throw new Error('An entry with this name already exists.');
                await files.rename(side, entry.path, files.child(side, directory.path, name));
              }
            } else if (request.type === 'delete') {
              const confirmed = await vscode.window.showWarningMessage(
                `Delete ${side} ${entry.type} "${entry.name}"?${side === 'remote' ? ' This cannot be undone.' : ''}`,
                { modal: true },
                'Delete',
              );
              if (confirmed === 'Delete') await files.remove(side, entry.path);
            } else if (request.type === 'open') {
              if (entry.type !== 'file') return;
              await files.open(side, entry.path);
              return;
            } else if (request.type === 'transfer') {
              const destinationSide = side === 'local' ? 'remote' : 'local';
              const destination = data[destinationSide];
              if (!destination) throw new Error('Connect to the remote directory first.');
              const name = side === 'local' ? basename(entry.path) : posix.basename(entry.path);
              if (name.includes('\\') || name === '.' || name === '..') throw new Error('Invalid file name.');
              const listing = await files.list(destinationSide, destination.path);
              if (listing.entries.some((candidate) => candidate.name === name)) {
                const confirmed = await vscode.window.showWarningMessage(
                  `"${name}" already exists in ${destination.path}. Existing files will be overwritten and folders will be merged.`,
                  { modal: true },
                  'Overwrite',
                );
                if (confirmed !== 'Overwrite') return;
              }
              await vscode.window.withProgress(
                {
                  location: vscode.ProgressLocation.Notification,
                  title: `${side === 'local' ? 'Uploading' : 'Downloading'} ${name}`,
                  cancellable: false,
                },
                () => files.transfer(side, entry.path, files.child(destinationSide, destination.path, name)),
              );
            }
          }
          await refresh(sides);
        } catch (error) {
          data.error = error instanceof Error ? error.message : String(error);
        } finally {
          for (const side of sides) busy[side] = false;
          await publish();
        }
      };
      handlers.set(asset.id, handleRequest);
      const listener = panel.webview.onDidReceiveMessage(handleRequest);
      const visibility = panel.onDidChangeViewState(() => {
        if (panel.visible) void publish();
      });
      panel.onDidDispose(() => {
        disposed = true;
        cancellation.abort();
        bridge.dispose();
        listener.dispose();
        visibility.dispose();
        panels.delete(asset.id);
        handlers.delete(asset.id);
      });
      panel.webview.html = getWebviewHtml(panel.webview, vscode.Uri.joinPath(context.extensionUri, 'dist'), {
        page: 'sftp',
        title: 'SFTP',
        data: { assetId: asset.id },
      });
    }),
  );
}

function askName(prompt: string, value?: string): Thenable<string | undefined> {
  return vscode.window.showInputBox({
    prompt,
    value,
    validateInput: (name) =>
      !name.trim() || name === '.' || name === '..' || /[\\/\0]/.test(name)
        ? 'Enter a valid file or folder name.'
        : undefined,
  });
}
