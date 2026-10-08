import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { AssetProvider } from '@/features/assets/asset-provider';
import type { AssetRequest, AssetViewEntry } from '@/features/assets/protocol';
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

  async configure(record?: AssetRecord): Promise<boolean> {
    const previous = record ? requireSshConfiguration(record) : undefined;
    const name = await prompt('Connection name', previous?.name ?? 'SSH');
    if (name === undefined) return false;
    const host = await prompt('Host', previous?.host ?? 'localhost', (value) =>
      validHost(value) ? undefined : 'Enter a hostname or IP address without SSH options.',
    );
    if (host === undefined) return false;
    const port = await prompt('Port', String(previous?.port ?? 22), (value) =>
      /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 65535
        ? undefined
        : 'Enter a port between 1 and 65535.',
    );
    if (port === undefined) return false;
    const user = await prompt('User', previous?.user ?? os.userInfo().username, (value) =>
      validUser(value) ? undefined : 'Enter a valid SSH username.',
    );
    if (user === undefined) return false;
    const authentication = await vscode.window.showQuickPick(
      [
        { label: 'SSH agent / default keys / password', key: false },
        { label: 'Private key file', key: true },
      ],
      { title: 'SSH authentication' },
    );
    if (!authentication) return false;
    let privateKeyPath: string | undefined;
    if (authentication.key) {
      const files = await vscode.window.showOpenDialog({
        title: 'SSH private key',
        canSelectMany: false,
        canSelectFiles: true,
        canSelectFolders: false,
        defaultUri: previous?.privateKeyPath
          ? vscode.Uri.file(previous.privateKeyPath)
          : vscode.Uri.file(path.join(os.homedir(), '.ssh')),
      });
      if (!files?.[0]) return false;
      if (files[0].scheme !== 'file') throw new Error('Select a key file accessible to the extension host.');
      privateKeyPath = files[0].fsPath;
    }
    const asset: SshConnectionConfiguration = {
      id: previous?.id ?? randomUUID(),
      type: this.type,
      name: name.trim(),
      host: host.trim(),
      port: Number(port),
      user: user.trim(),
      privateKeyPath,
    };
    await this.assets.save(asset);
    this.invalidate(asset.id);
    return true;
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
function prompt(
  title: string,
  value: string,
  validate?: (value: string) => string | undefined,
): Thenable<string | undefined> {
  return vscode.window.showInputBox({
    title: `SSH ${title}`,
    value,
    validateInput: (input) => (!input.trim() ? `${title} is required.` : validate?.(input.trim())),
  });
}
