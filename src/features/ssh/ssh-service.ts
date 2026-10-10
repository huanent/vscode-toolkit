import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import type { AssetProvider } from '@/features/assets/asset-provider';
import type { AssetFormValues, AssetRequest, AssetViewEntry } from '@/features/assets/protocol';
import { AssetService, type AssetRecord } from '@/features/assets/service';
import type { SshConnectionConfiguration } from './protocol';
import type { CredentialService } from '@/features/credential/service';

export class SshService implements AssetProvider {
  readonly type = 'ssh';
  readonly label = 'SSH';
  private readonly terminals = new Map<string, Set<vscode.Terminal>>();
  private readonly closed: vscode.Disposable;

  constructor(
    private readonly assets: AssetService,
    private readonly credentials: CredentialService,
  ) {
    this.closed = vscode.window.onDidCloseTerminal((terminal) => {
      for (const [id, terminals] of this.terminals) {
        terminals.delete(terminal);
        if (!terminals.size) this.terminals.delete(id);
      }
    });
  }

  getFormValues(record?: AssetRecord): AssetFormValues {
    const previous = record ? requireSshConfiguration(record) : undefined;
    return {
      name: previous?.name ?? 'SSH',
      host: previous?.host ?? 'localhost',
      port: previous?.port ?? 22,
      credentialId: previous?.credentialId ?? '',
      database: '',
      tls: false,
    };
  }

  async saveConfiguration(values: AssetFormValues, record?: AssetRecord, parentId?: string): Promise<void> {
    const previous = record ? requireSshConfiguration(record) : undefined;
    const asset: SshConnectionConfiguration = {
      id: previous?.id ?? randomUUID(),
      type: this.type,
      parentId: record?.parentId ?? parentId,
      name: values.name.trim(),
      host: values.host.trim(),
      port: values.port,
      credentialId: values.credentialId,
    };
    requireSshConfiguration(asset);
    await this.assets.save(asset);
    this.invalidate(asset.id);
  }

  toViewEntry(record: AssetRecord): AssetViewEntry {
    const asset = requireSshConfiguration(record);
    return {
      path: asset.id,
      name: asset.name,
      type: 'file',
      detail: `SSH - ${asset.host}:${asset.port}`,
      context: { assetId: asset.id, assetType: this.type, assetConnected: this.terminals.has(asset.id) },
    };
  }

  async execute(record: AssetRecord, request: AssetRequest): Promise<void> {
    const asset = requireSshConfiguration(record);
    if (request.action === 'disconnect') {
      this.invalidate(asset.id);
      return;
    }
    if (request.action !== 'connect') throw new Error('Unsupported SSH operation.');
    const credentials = await this.credentials.list();
    const credential = credentials.find((c) => c.id === asset.credentialId);
    if (!credential) throw new Error('Credential not found.');
    const args = ['-p', String(asset.port), '-l', credential.username ?? ''];
    if (credential.privateKey) args.push('-i', credential.privateKey);
    args.push('--', asset.host);
    const terminal = vscode.window.createTerminal({ name: `SSH: ${asset.name}`, shellPath: 'ssh', shellArgs: args });
    const terminals = this.terminals.get(asset.id) ?? new Set<vscode.Terminal>();
    terminals.add(terminal);
    this.terminals.set(asset.id, terminals);
    terminal.show();
  }

  invalidate(id?: string): void {
    for (const [assetId, terminals] of this.terminals) {
      if (id && assetId !== id) continue;
      for (const terminal of terminals) terminal.dispose();
      this.terminals.delete(assetId);
    }
  }

  dispose(): void {
    this.closed.dispose();
    this.invalidate();
  }
}

function validHost(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9.:%_-]*$/.test(value);
}
function requireSshConfiguration(value: AssetRecord): SshConnectionConfiguration {
  const asset = value as Partial<SshConnectionConfiguration>;
  if (
    asset.type !== 'ssh' ||
    typeof asset.host !== 'string' ||
    !validHost(asset.host) ||
    typeof asset.port !== 'number' ||
    !Number.isInteger(asset.port) ||
    asset.port < 1 ||
    asset.port > 65535 ||
    typeof asset.credentialId !== 'string'
  )
    throw new Error(`Invalid SSH configuration: ${value.name}`);
  return value as SshConnectionConfiguration;
}
