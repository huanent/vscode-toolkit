import * as vscode from 'vscode';
import { registerWebviewEditor } from '@/host/webview-editor';
import type { ContainerEditorData, ContainerEditorMessage } from './protocol';
import type { ContainerService } from './service';

export const containerEditorViewType = 'toolkit.containerEditor';

export function createContainerUri(id: string, name: string): vscode.Uri {
  return vscode.Uri.parse(
    `toolkit-container:/containers.toolkit-container?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`,
  );
}

function assetIdFromUri(uri: vscode.Uri): string {
  const id = new URLSearchParams(uri.query).get('id');
  if (uri.scheme !== 'toolkit-container' || !id) throw new Error('Invalid container editor URI.');
  return id;
}

export function registerContainerEditor(
  context: vscode.ExtensionContext,
  service: ContainerService,
): vscode.Disposable {
  return registerWebviewEditor<ContainerEditorData>(context, {
    viewType: containerEditorViewType,
    page: 'container',
    icon: 'server',
    validate: (uri) => {
      assetIdFromUri(uri);
    },
    load: async (uri) => {
      const assetId = assetIdFromUri(uri);
      const asset = await service.requireAsset(assetId);
      return { assetId, assetName: asset.name, containers: await service.list(assetId) };
    },
    title: (uri) => new URLSearchParams(uri.query).get('name') ?? 'Containers',
    onPanelResolved: (uri, panel) =>
      panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (!message || typeof message !== 'object' || !('type' in message)) return;
        const request = message as { type: unknown; id?: unknown };
        if (!['list', 'start', 'stop', 'restart', 'logs'].includes(String(request.type))) return;
        try {
          const assetId = assetIdFromUri(uri);
          if (request.type !== 'list' && typeof request.id !== 'string') throw new Error('Container ID is required.');
          if (request.type === 'logs') {
            const id = request.id as string;
            await panel.webview.postMessage({
              type: 'logs',
              id,
              logs: await service.logs(assetId, id),
            } satisfies ContainerEditorMessage);
          } else {
            if (request.type === 'start' || request.type === 'stop' || request.type === 'restart') {
              await service.action(assetId, request.type, request.id as string);
            }
            await panel.webview.postMessage({
              type: 'containersUpdated',
              containers: await service.list(assetId),
            } satisfies ContainerEditorMessage);
          }
        } catch (error) {
          await panel.webview.postMessage({
            type: 'containerError',
            message: error instanceof Error ? error.message : String(error),
          } satisfies ContainerEditorMessage);
        }
      }),
  });
}
