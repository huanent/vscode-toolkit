import * as vscode from 'vscode';
import { serveWebviewData } from '@/host/webview-bridge';
import { getWebviewHtml } from '@/host/webview-html';
import { resolveStorageDirectory } from '@/host/utils/storage';
import type { AssetProvider } from './asset-provider';
import type { AssetEditorData, AssetEditorMessage, AssetFormValues } from './protocol';
import type { AssetRecord, AssetService } from './service';
import type { Credential } from '@/features/credential/protocol';
import type { CredentialService } from '@/features/credential/service';

export function openAssetEditor(
  context: vscode.ExtensionContext,
  service: AssetService,
  provider: AssetProvider,
  refresh: () => Promise<void>,
  credentials: CredentialService,
  previous?: AssetRecord,
  folder?: string,
): void {
  const values = provider.getFormValues(previous);
  const assetsUri = vscode.Uri.file(__dirname);
  const panel = vscode.window.createWebviewPanel(
    'toolkit.assetEditor',
    previous ? `Edit ${previous.name}` : `New ${provider.label}`,
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [assetsUri] },
  );
  panel.webview.html = getWebviewHtml(panel.webview, assetsUri, { page: 'asset' });
  let saving = false;
  let disposed = false;
  const storageDirectory = resolveStorageDirectory(context, 'assets');
  const bridge = serveWebviewData(panel.webview, async () => {
    const creds = await credentials.list();
    const sshConnections =
      provider.type === 'ssh'
        ? (await service.list()).flatMap((record) => {
            if (
              record.id === previous?.id ||
              record.type !== 'ssh' ||
              !('host' in record) ||
              typeof record.host !== 'string' ||
              !('port' in record) ||
              typeof record.port !== 'number'
            ) {
              return [];
            }
            return [{ id: record.id, name: record.name, host: record.host, port: record.port }];
          })
        : [];
    return {
      assetType: provider.type,
      label: provider.label,
      editing: Boolean(previous),
      values,
      credentials: creds.map(({ id, description, type, username }) => ({ id, description, type, username })),
      sshConnections,
    } satisfies AssetEditorData;
  });
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
        await provider.saveConfiguration(message.values, current, folder);
        await refresh();
        panel.dispose();
      } else if (message.type === 'createCredential') {
        if (!('credential' in message) || !isCredential(message.credential) || message.credential.id !== '') {
          throw new Error('Invalid credential.');
        }
        await credentials.save(message.credential);
        const savedCredentials = await credentials.list();
        await panel.webview.postMessage({
          type: 'credentialsUpdated',
          credentials: savedCredentials.map(({ id, description, type, username }) => ({
            id,
            description,
            type,
            username,
          })),
          createdId: message.credential.id,
        } satisfies AssetEditorMessage);
      }
    } catch (error) {
      if (!disposed)
        await panel.webview.postMessage({
          type: message.type === 'createCredential' ? 'credentialError' : 'saveError',
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

function isCredential(value: unknown): value is Credential {
  if (!value || typeof value !== 'object') return false;
  const credential = value as Partial<Credential>;
  return (
    typeof credential.id === 'string' &&
    typeof credential.description === 'string' &&
    (credential.type === 'password' || credential.type === 'privateKey') &&
    (credential.username === undefined || typeof credential.username === 'string') &&
    (credential.password === undefined || typeof credential.password === 'string') &&
    (credential.privateKey === undefined || typeof credential.privateKey === 'string') &&
    (credential.passphrase === undefined || typeof credential.passphrase === 'string')
  );
}

function isFormValues(value: unknown): value is AssetFormValues {
  if (!value || typeof value !== 'object') return false;
  const values = value as Partial<AssetFormValues>;
  return (
    [values.name, values.host, values.database, values.credentialId].every((field) => typeof field === 'string') &&
    (values.proxyAssetId === undefined || typeof values.proxyAssetId === 'string') &&
    typeof values.tls === 'boolean' &&
    typeof values.enableAI === 'boolean' &&
    typeof values.port === 'number' &&
    Number.isInteger(values.port) &&
    values.port > 0 &&
    values.port <= 65535
  );
}
