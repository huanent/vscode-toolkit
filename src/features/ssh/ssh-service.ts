import { createHash, randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { Client, type ClientChannel, type ConnectConfig, type VerifyCallback } from 'ssh2';
import type { AssetProvider } from '@/features/assets/asset-provider';
import type { AssetFormValues, AssetRequest, AssetViewEntry } from '@/features/assets/protocol';
import { AssetService, type AssetRecord } from '@/features/assets/service';
import type { SshConnectionConfiguration } from './protocol';
import type { CredentialService } from '@/features/credential/service';
import type { Credential } from '@/features/credential/protocol';

export class SshService implements AssetProvider {
  readonly type = 'ssh';
  readonly label = 'SSH';
  private readonly terminals = new Map<string, Set<vscode.Terminal>>();
  private readonly closed: vscode.Disposable;

  constructor(
    private readonly assets: AssetService,
    private readonly credentials: CredentialService,
    private readonly globalState: vscode.Memento,
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

  async listConnections(): Promise<{ id: string; name: string; host: string; port: number }[]> {
    return (await this.assets.list())
      .filter((asset) => asset.type === this.type)
      .map((asset) => {
        const connection = requireSshConfiguration(asset);
        return { id: connection.id, name: connection.name, host: connection.host, port: connection.port };
      });
  }

  async runCommand(assetId: string, command: string): Promise<{ stdout: string; stderr: string; exitCode?: number }> {
    if (!command.trim()) throw new Error('Enter an SSH command.');
    const client = await this.connectClient(assetId);
    return new Promise((resolve, reject) => {
      client.exec(command, (error, channel) => {
        if (error) {
          client.end();
          reject(error);
          return;
        }
        let stdout = '';
        let stderr = '';
        channel.on('data', (data: Buffer) => (stdout += data.toString('utf8')));
        channel.stderr.on('data', (data: Buffer) => (stderr += data.toString('utf8')));
        channel.on('close', (exitCode: number | undefined) => {
          client.end();
          resolve({ stdout, stderr, exitCode });
        });
      });
    });
  }

  async transferFile(
    assetId: string,
    direction: 'upload' | 'download',
    localPath: string,
    remotePath: string,
  ): Promise<void> {
    if (!localPath.trim() || !remotePath.trim()) throw new Error('Enter both local and remote file paths.');
    const client = await this.connectClient(assetId);
    await new Promise<void>((resolve, reject) => {
      client.sftp((error, sftp) => {
        if (error) {
          client.end();
          reject(error);
          return;
        }
        const complete = (transferError?: Error | null) => {
          client.end();
          if (transferError) reject(transferError);
          else resolve();
        };
        if (direction === 'upload') sftp.fastPut(localPath, remotePath, complete);
        else sftp.fastGet(remotePath, localPath, complete);
      });
    });
  }

  private async connectClient(assetId: string): Promise<Client> {
    const asset = requireSshConfiguration(await this.assets.get(assetId));
    const credential = (await this.credentials.list()).find((candidate) => candidate.id === asset.credentialId);
    if (!credential) throw new Error('Credential not found.');
    if (!credential.username) throw new Error('SSH username is required.');
    if (credential.type === 'password' && !credential.password) throw new Error('SSH password is required.');
    if (credential.type === 'privateKey' && !credential.privateKey) throw new Error('SSH private key is required.');

    const config: ConnectConfig = {
      host: asset.host,
      port: asset.port,
      username: credential.username,
      readyTimeout: 20000,
      keepaliveInterval: 10000,
      hostVerifier: (key: Buffer, verify: VerifyCallback) => {
        void verifySshHost(asset, this.globalState, key).then(verify, () => verify(false));
      },
    };
    if (credential.type === 'password') config.password = credential.password;
    else {
      config.privateKey = credential.privateKey;
      config.passphrase = credential.passphrase;
    }

    const client = new Client();
    return new Promise((resolve, reject) => {
      client.once('ready', () => resolve(client));
      client.once('error', (error) => {
        client.end();
        reject(error);
      });
      client.connect(config);
    });
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
      context: { assetId: asset.id, assetType: this.type },
    };
  }

  async execute(record: AssetRecord, request: AssetRequest): Promise<void> {
    const asset = requireSshConfiguration(record);
    if (request.action !== 'connect') throw new Error('Unsupported SSH operation.');
    const credentials = await this.credentials.list();
    const credential = credentials.find((c) => c.id === asset.credentialId);
    if (!credential) throw new Error('Credential not found.');
    if (!credential.username) throw new Error('SSH username is required.');
    if (credential.type === 'password' && !credential.password) throw new Error('SSH password is required.');
    if (credential.type === 'privateKey' && !credential.privateKey) throw new Error('SSH private key is required.');
    const pty = new SshPseudoterminal(asset, credential, this.globalState);
    const terminal = vscode.window.createTerminal({
      name: `SSH: ${asset.name}`,
      pty,
      location: vscode.TerminalLocation.Editor,
    });
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

class SshPseudoterminal implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  readonly onDidWrite = this.writeEmitter.event;
  private client?: Client;
  private channel?: ClientChannel;
  private dimensions: vscode.TerminalDimensions = { columns: 80, rows: 24 };
  private closed = false;
  private ended = false;

  constructor(
    private readonly asset: SshConnectionConfiguration,
    private readonly credential: Credential,
    private readonly globalState: vscode.Memento,
  ) {}

  open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    if (initialDimensions) this.dimensions = initialDimensions;
    this.connect();
  }

  close(): void {
    this.closed = true;
    this.channel?.close();
    this.client?.end();
    this.writeEmitter.dispose();
  }

  handleInput(data: string): void {
    this.channel?.write(data);
  }

  setDimensions(dimensions: vscode.TerminalDimensions): void {
    this.dimensions = dimensions;
    this.channel?.setWindow(dimensions.rows, dimensions.columns, 0, 0);
  }

  private connect(): void {
    const client = new Client();
    this.client = client;
    const config: ConnectConfig = {
      host: this.asset.host,
      port: this.asset.port,
      username: this.credential.username,
      readyTimeout: 20000,
      keepaliveInterval: 10000,
      hostVerifier: (key: Buffer, verify: VerifyCallback) => {
        void this.verifyHost(key).then(verify, () => verify(false));
      },
    };
    if (this.credential.type === 'password') config.password = this.credential.password;
    else {
      config.privateKey = this.credential.privateKey;
      config.passphrase = this.credential.passphrase;
    }

    client
      .on('ready', () => {
        if (this.closed) return client.end();
        client.shell(
          {
            term: 'xterm-256color',
            cols: this.dimensions.columns,
            rows: this.dimensions.rows,
          },
          (error, channel) => {
            if (error) return this.showError(error);
            if (this.closed) return channel.close();
            this.channel = channel;
            channel.on('data', (data: Buffer) => this.writeEmitter.fire(data.toString('utf8')));
            channel.stderr.on('data', (data: Buffer) => this.writeEmitter.fire(data.toString('utf8')));
            channel.on('close', () => this.finish());
          },
        );
      })
      .on('error', (error) => this.showError(error))
      .on('close', () => this.finish());
    client.connect(config);
  }

  private async verifyHost(key: Buffer): Promise<boolean> {
    return verifySshHost(this.asset, this.globalState, key);
  }

  private showError(error: Error): void {
    if (this.closed || this.ended) return;
    this.writeEmitter.fire(`\r\nSSH error: ${error.message}\r\n`);
    this.finish();
  }

  private finish(): void {
    if (this.closed || this.ended) return;
    this.ended = true;
    this.channel = undefined;
    this.client?.end();
    this.writeEmitter.fire('\r\nSSH connection closed.\r\n');
  }
}

async function verifySshHost(
  asset: SshConnectionConfiguration,
  globalState: vscode.Memento,
  key: Buffer,
): Promise<boolean> {
  const hostId = `${asset.host}:${asset.port}`;
  const trustedHosts = globalState.get<Record<string, string>>('toolkit.ssh.hostKeys', {});
  const fingerprint = createHash('sha256').update(key).digest();
  const currentKey = fingerprint.toString('hex');
  if (trustedHosts[hostId] === currentKey) return true;

  const displayedFingerprint = `SHA256:${fingerprint.toString('base64').replace(/=+$/, '')}`;
  const changed = Boolean(trustedHosts[hostId]);
  const choice = await vscode.window.showWarningMessage(
    `${changed ? 'SSH host key changed' : 'Trust SSH host'} for ${hostId}? Fingerprint: ${displayedFingerprint}`,
    { modal: true },
    'Trust Host',
  );
  if (choice !== 'Trust Host') return false;
  await globalState.update('toolkit.ssh.hostKeys', { ...trustedHosts, [hostId]: currentKey });
  return true;
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
