import * as vscode from 'vscode';
import { serveWebviewData } from '@/host/webview-bridge';
import { getWebviewHtml } from '@/host/webview-html';
import { resolveStorageDirectory } from '@/host/utils/storage';
import type { AssetProvider } from './asset-provider';
import type { AssetEditorData, AssetEditorMessage, AssetFormValues } from './protocol';
import type { AssetRecord, AssetService } from './service';
import type { CredentialService } from '@/features/credential/service';

export function openAssetEditor(
  context: vscode.ExtensionContext,
  service: AssetService,
  provider: AssetProvider,
  refresh: () => Promise<void>,
  credentials: CredentialService,
  previous?: AssetRecord,
  parentId?: string,
): void {
  const values = provider.getFormValues(previous);
  const assetsUri = vscode.Uri.file(__dirname);
  const panel = vscode.window.createWebviewPanel(
    'toolkit.assetEditor',
    previous ? `Edit ${previous.name}` : `New ${provider.label}`,
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [assetsUri] },
  );
  panel.webview.html = getWebviewHtml(panel.webview, assetsUri, { page: 'asset-editor' });
  let saving = false;
  let disposed = false;
  const storageDirectory = resolveStorageDirectory(context, 'assets');
  const bridge = serveWebviewData(
    panel.webview,
    async () => {
      const creds = await credentials.list();
      return {
        assetType: provider.type,
        label: provider.label,
        editing: Boolean(previous),
        values,
        credentials: creds.map((c) => ({ id: c.id, name: c.name })),
      } satisfies AssetEditorData;
    },
  );
  const listener = panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (!message || typeof message !== 'object' || !('type' in message)) return;
    if (saving) return;
    try {
      if (message.type === 'cancel') {
        panel.dispose();
      } else if (message.type === 'save') {
        if (!('values' in message) || !isFormValues(message.values)) throw new Error('Invalid asset configuration.');
        saving = true;
        if (storageDirectory !== resolveStorageDirectory(context, 'assets'))
          throw new Error('Storage location changed. Reopen the asset editor.');
        const current = previous ? await service.get(previous.id) : undefined;
        await provider.saveConfiguration(message.values, current, parentId);
        await refresh();
        panel.dispose();
      }
    } catch (error) {
      if (!disposed)
        await panel.webview.postMessage({
          type: 'saveError',
          message: error instanceof Error ? error.message : String(error),
        } satisfies AssetEditorMessage);
    } finally {
      if (message.type === 'save') saving = false;
    }
  });
  const closed = panel.onDidDispose(() => {
    disposed = true;
    bridge.dispose();
    listener.dispose();
    closed.dispose();
  });
  context.subscriptions.push(panel, bridge, listener, closed);
}

function isFormValues(value: unknown): value is AssetFormValues {
  if (!value || typeof value !== 'object') return false;
  const values = value as Partial<AssetFormValues>;
  return (
    [values.name, values.host, values.database, values.credentialId].every(
      (field) => typeof field === 'string',
    ) &&
    typeof values.tls === 'boolean' &&
    typeof values.port === 'number' &&
    Number.isInteger(values.port) &&
    values.port > 0 &&
    values.port <= 65535
  );
}
