import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import * as vscode from 'vscode';
import type { AssetProvider } from '@/features/assets/asset-provider';
import type { AssetFormValues, AssetRequest, AssetViewEntry } from '@/features/assets/protocol';
import { AssetService, type AssetRecord } from '@/features/assets/service';
import type { SshConnectionConfiguration } from './protocol';

export class SshService implements AssetProvider {
  readonly type = 'ssh';
  readonly label = 'SSH';
  private readonly terminals = new Map<string, Set<vscode.Terminal>>();
  private readonly closed: vscode.Disposable;

  constructor(private readonly assets: AssetService) {
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
      user: previous?.user ?? os.userInfo().username,
      privateKeyPath: previous?.privateKeyPath ?? '',
      database: '',
      tls: false,
      password: '',
    };
  }

  async saveConfiguration(values: AssetFormValues, record?: AssetRecord): Promise<void> {
    const previous = record ? requireSshConfiguration(record) : undefined;
    const asset: SshConnectionConfiguration = {
      id: previous?.id ?? randomUUID(),
      type: this.type,
      name: values.name.trim(),
      host: values.host.trim(),
      port: values.port,
      user: values.user.trim(),
      privateKeyPath: values.privateKeyPath.trim() || undefined,
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
      detail: `SSH - ${asset.user}@${asset.host}:${asset.port}`,
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
    const args = ['-p', String(asset.port), '-l', asset.user];
    if (asset.privateKeyPath) args.push('-i', asset.privateKeyPath);
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
function validUser(value: string): boolean {
  return /^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(value);
}
function requireSshConfiguration(value: AssetRecord): SshConnectionConfiguration {
  const asset = value as Partial<SshConnectionConfiguration>;
  if (
    asset.type !== 'ssh' ||
    typeof asset.host !== 'string' ||
    !validHost(asset.host) ||
    typeof asset.user !== 'string' ||
    !validUser(asset.user) ||
    typeof asset.port !== 'number' ||
    !Number.isInteger(asset.port) ||
    asset.port < 1 ||
    asset.port > 65535 ||
    (asset.privateKeyPath !== undefined && typeof asset.privateKeyPath !== 'string')
  )
    throw new Error(`Invalid SSH configuration: ${value.name}`);
  return value as SshConnectionConfiguration;
}
