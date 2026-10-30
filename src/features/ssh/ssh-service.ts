import { createHash, randomUUID } from 'node:crypto';
import { createServer, type Socket } from 'node:net';
import * as vscode from 'vscode';
import { Client, type ClientChannel, type ConnectConfig, type SFTPWrapper, type VerifyCallback } from 'ssh2';
import type { AssetProvider } from '@/features/assets/asset-provider';
import type { AssetFormValues, AssetRequest, AssetViewEntry } from '@/features/assets/protocol';
import { formatTabTitle } from '@/shared/tab-title';
import { AssetService, type AssetRecord } from '@/features/assets/service';
import type { SshConnectionConfiguration } from './protocol';
import type { CredentialService } from '@/features/credential/service';
import { CommandOutput } from '@/host/utils/command-output';
import { stagedUpload } from './sftp/staged-upload';
import { buildLoginShellCommand } from './login-shell-command';

interface SshClientSession {
  client: Client;
  close(): void;
}

export class SshService implements AssetProvider {
  readonly type = 'ssh';
  readonly label = 'SSH';
  readonly icon = 'terminal';
  readonly capabilities = { proxyTunnel: true };
  private readonly terminals = new Map<string, Set<vscode.Terminal>>();
  private readonly tunnels = new Set<() => void>();
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
      name: previous?.name ?? '',
      description: record?.description ?? '',
      host: previous?.host ?? 'localhost',
      port: previous?.port ?? 22,
      credentialId: previous?.credentialId ?? '',
      proxyAssetIds: previous?.proxyAssetIds ?? [],
      database: '',
      tls: false,
      enableAI: record?.enableAI !== false,
      storageScope: record?.scope ?? 'global',
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

  async resolveConnectionId(assetId: string): Promise<string> {
    return requireSshConfiguration(await this.assets.get(assetId)).id;
  }

  async runCommand(
    assetId: string,
    command: string,
    signal?: AbortSignal,
    onOutput?: (data: Buffer) => void,
    input?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode?: number }> {
    return this.runSessionCommand(assetId, command, false, signal, onOutput, input);
  }

  async runLoginCommand(
    assetId: string,
    command: string,
    signal?: AbortSignal,
    onOutput?: (data: Buffer) => void,
  ): Promise<{ stdout: string; stderr: string; exitCode?: number }> {
    return this.runSessionCommand(assetId, command, true, signal, onOutput);
  }

  private async runSessionCommand(
    assetId: string,
    command: string,
    loginShell: boolean,
    signal?: AbortSignal,
    onOutput?: (data: Buffer) => void,
    input?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode?: number }> {
    if (!command.trim()) throw new Error('Enter an SSH command.');
    return this.withSession(assetId, signal, (session, resolve, reject) => {
      const onChannel = (error: Error | undefined, channel: ClientChannel) => {
        if (error) {
          session.close();
          reject(error);
          return;
        }
        const stdout = new CommandOutput();
        const stderr = new CommandOutput();
        channel.on('data', (data: Buffer) => {
          stdout.append(data);
          onOutput?.(data);
        });
        channel.stderr.on('data', (data: Buffer) => {
          stderr.append(data);
          onOutput?.(data);
        });
        channel.once('error', reject);
        channel.on('close', (exitCode: number | undefined) => {
          resolve({ stdout: stdout.toString(), stderr: stderr.toString(), exitCode });
        });
        if (input !== undefined) channel.end(input);
      };
      if (!loginShell) {
        session.client.exec(command, onChannel);
        return;
      }
      session.client.exec('echo "$SHELL"', (error, channel) => {
        if (error) {
          reject(error);
          return;
        }
        const output = new CommandOutput();
        let failed = false;
        channel.on('data', (data: Buffer) => output.append(data));
        channel.stderr.resume();
        channel.once('error', (channelError: Error) => {
          failed = true;
          reject(channelError);
        });
        channel.once('close', (exitCode: number | undefined) => {
          if (failed || signal?.aborted) return;
          session.client.exec(
            buildLoginShellCommand(command, exitCode === 0 ? output.toString() : ''),
            { pty: true },
            onChannel,
          );
        });
      });
    });
  }

  async transferFile(
    assetId: string,
    direction: 'upload' | 'download',
    localPath: string,
    remotePath: string,
    signal?: AbortSignal,
    onProgress?: (transferredBytes: number, totalBytes: number) => void,
  ): Promise<void> {
    if (!localPath.trim() || !remotePath.trim()) throw new Error('Enter both local and remote file paths.');
    await this.withSession<void>(assetId, signal, (session, resolve, reject) => {
      session.client.sftp((error, sftp) => {
        if (error) {
          session.close();
          reject(error);
          return;
        }
        const complete = (transferError?: Error | null) => {
          if (transferError) reject(transferError);
          else resolve();
        };
        sftp.once('error', reject);
        const options = { step: (total: number, _chunk: number, size: number) => onProgress?.(total, size) };
        if (direction === 'upload')
          void stagedUpload(
            sftp,
            remotePath,
            (temporaryPath) =>
              new Promise<void>((resolveUpload, rejectUpload) => {
                sftp.fastPut(localPath, temporaryPath, options, (uploadError) =>
                  uploadError ? rejectUpload(uploadError) : resolveUpload(),
                );
              }),
          ).then(() => resolve(), reject);
        else sftp.fastGet(remotePath, localPath, options, complete);
      });
    });
  }

  async withSftp<T>(assetId: string, signal: AbortSignal, run: (sftp: SFTPWrapper) => Promise<T>): Promise<T> {
    return this.withSession<T>(assetId, signal, (session, resolve, reject) => {
      session.client.sftp((error, sftp) => {
        if (error) return reject(error);
        sftp.once('error', reject);
        void run(sftp).then(resolve, reject);
      });
    });
  }

  createSftpRunner(assetId: string, signal: AbortSignal): <T>(run: (sftp: SFTPWrapper) => Promise<T>) => Promise<T> {
    let connection: Promise<SshClientSession> | undefined;
    const connect = () => {
      signal.throwIfAborted();
      if (!connection) {
        const pending = this.connectClient(assetId, new Set(), signal);
        connection = pending;
        void pending.then(
          (session) => {
            const close = () => {
              if (connection === pending) connection = undefined;
              signal.removeEventListener('abort', abort);
              session.close();
            };
            const abort = () => {
              session.client.destroy();
              close();
            };
            session.client.once('close', close);
            signal.addEventListener('abort', abort, { once: true });
            if (signal.aborted) abort();
          },
          () => {
            if (connection === pending) connection = undefined;
          },
        );
      }
      return connection;
    };
    return async <T>(run: (sftp: SFTPWrapper) => Promise<T>): Promise<T> => {
      const session = await connect();
      signal.throwIfAborted();
      return new Promise<T>((resolve, reject) => {
        let channel: SFTPWrapper | undefined;
        let settled = false;
        const closed = () => finish(new Error('SSH connection closed before the operation completed.'));
        const finish = (error?: Error, result?: T) => {
          if (settled) return;
          settled = true;
          session.client.removeListener('close', closed);
          channel?.end();
          if (error) reject(error);
          else resolve(result as T);
        };
        session.client.once('close', closed);
        session.client.sftp((error, sftp) => {
          if (error) return finish(error);
          if (settled) return sftp.end();
          channel = sftp;
          sftp.once('error', finish);
          void run(sftp).then((result) => finish(undefined, result), finish);
        });
      });
    };
  }

  async openTunnel(
    proxyAssetIds: string[],
    host: string,
    port: number,
    cancellation?: AbortSignal,
  ): Promise<{ host: string; port: number; close(): void }> {
    if (!proxyAssetIds.length) throw new Error('An SSH jump host is required.');
    const controller = new AbortController();
    const signal = cancellation ? AbortSignal.any([cancellation, controller.signal]) : controller.signal;
    let closed = false;
    let session: SshClientSession | undefined;
    const sockets = new Set<Socket>();
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.on('error', () => socket.destroy());
      socket.once('close', () => sockets.delete(socket));
      session!.client.forwardOut('127.0.0.1', 0, host, port, (error, channel) => {
        if (error) {
          socket.destroy(error);
          return;
        }
        channel.on('error', () => socket.destroy());
        socket.once('close', () => channel.destroy());
        channel.once('close', () => socket.destroy());
        if (socket.destroyed) channel.destroy();
        else socket.pipe(channel).pipe(socket);
      });
    });
    const close = () => {
      if (closed) {
        session?.close();
        return;
      }
      closed = true;
      signal.removeEventListener('abort', close);
      controller.abort();
      this.tunnels.delete(close);
      for (const socket of sockets) socket.destroy();
      server.close();
      session?.close();
    };
    this.tunnels.add(close);
    signal.addEventListener('abort', close, { once: true });
    try {
      for (const id of proxyAssetIds) {
        session = await this.connectClient(id, new Set(), signal, session);
      }
      session!.client.once('close', close);
      let cleanup = () => {};
      try {
        await new Promise<void>((resolve, reject) => {
          const abort = () => reject(new Error('SSH tunnel was cancelled.'));
          signal.addEventListener('abort', abort, { once: true });
          cleanup = () => signal.removeEventListener('abort', abort);
          server.once('error', reject);
          server.listen({ port: 0, host: '127.0.0.1', signal }, resolve);
          if (signal.aborted) abort();
        });
      } finally {
        cleanup();
      }
      signal.throwIfAborted();
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('SSH tunnel failed to listen.');
      return { host: '127.0.0.1', port: address.port, close };
    } catch (error) {
      close();
      throw error;
    }
  }

  private async withSession<T>(
    assetId: string,
    signal: AbortSignal | undefined,
    run: (session: SshClientSession, resolve: (value: T) => void, reject: (error: Error) => void) => void,
  ): Promise<T> {
    const session = await this.connectClient(assetId, new Set(), signal);
    let cleanup = () => {};
    try {
      return await new Promise<T>((resolve, reject) => {
        const abort = () => {
          session.client.destroy();
          reject(new Error('SSH operation was cancelled. Remote processes may still be running.'));
        };
        const closed = () => reject(new Error('SSH connection closed before the operation completed.'));
        cleanup = () => {
          signal?.removeEventListener('abort', abort);
          session.client.removeListener('error', reject);
          session.client.removeListener('close', closed);
        };
        signal?.addEventListener('abort', abort, { once: true });
        session.client.once('error', reject);
        session.client.once('close', closed);
        if (signal?.aborted) return abort();
        run(session, resolve, reject);
      });
    } finally {
      cleanup();
      session.close();
    }
  }

  private async connectClient(
    assetId: string,
    proxyChain = new Set<string>(),
    signal?: AbortSignal,
    upstreamSession?: SshClientSession,
  ): Promise<SshClientSession> {
    signal?.throwIfAborted();
    if (proxyChain.has(assetId)) throw new Error('SSH proxy chain contains a cycle.');
    const nextProxyChain = new Set(proxyChain).add(assetId);
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

    let proxySession = upstreamSession;
    try {
      for (const proxyAssetId of asset.proxyAssetIds ?? []) {
        proxySession = await this.connectClient(proxyAssetId, nextProxyChain, signal, proxySession);
      }
      if (proxySession) {
        config.sock = await new Promise<ClientChannel>((resolve, reject) => {
          const abort = () => {
            proxySession?.close();
            reject(new Error('SSH connection was cancelled.'));
          };
          signal?.addEventListener('abort', abort, { once: true });
          if (signal?.aborted) {
            signal.removeEventListener('abort', abort);
            abort();
            return;
          }
          proxySession?.client.forwardOut('127.0.0.1', 0, asset.host, asset.port, (error, channel) => {
            signal?.removeEventListener('abort', abort);
            if (error) reject(error);
            else resolve(channel);
          });
        });
      }

      const client = new Client();
      try {
        return await new Promise<SshClientSession>((resolve, reject) => {
          let settled = false;
          const abort = () => {
            client.destroy();
            reject(new Error('SSH connection was cancelled.'));
          };
          const cleanup = () => signal?.removeEventListener('abort', abort);
          signal?.addEventListener('abort', abort, { once: true });
          if (signal?.aborted) {
            cleanup();
            abort();
            return;
          }
          client.once('close', () => {
            cleanup();
            if (!settled) reject(new Error('SSH connection closed before it was ready.'));
          });
          client.on('error', (error) => {
            cleanup();
            if (settled) {
              proxySession?.close();
              return;
            }
            settled = true;
            reject(error);
          });
          client.once('ready', () => {
            cleanup();
            if (settled) return;
            settled = true;
            let closed = false;
            const session: SshClientSession = {
              client,
              close: () => {
                if (closed) return;
                closed = true;
                client.end();
                proxySession?.close();
              },
            };
            client.once('close', () => proxySession?.close());
            resolve(session);
          });
          client.connect(config);
        });
      } catch (error) {
        client.end();
        throw error;
      }
    } catch (error) {
      proxySession?.close();
      throw error;
    }
  }

  async saveConfiguration(values: AssetFormValues, record?: AssetRecord, folder?: string): Promise<void> {
    const previous = record ? requireSshConfiguration(record) : undefined;
    const asset: SshConnectionConfiguration = {
      id: previous?.id ?? randomUUID(),
      type: this.type,
      name: values.name.trim(),
      host: values.host.trim(),
      port: values.port,
      credentialId: values.credentialId,
      proxyAssetIds: values.proxyAssetIds?.map((id) => id.trim()) ?? [],
      sftpFavorites: previous?.sftpFavorites,
    };
    requireSshConfiguration(asset);
    await this.validateProxyChain(asset.id, asset.proxyAssetIds);
    await this.assets.save({
      ...asset,
      description: values.description.trim() || undefined,
      enableAI: values.enableAI,
      folder: record?.folder ?? folder,
      scope: values.storageScope,
    });
    this.invalidate(asset.id);
  }

  toViewEntry(record: AssetRecord): AssetViewEntry {
    const asset = requireSshConfiguration(record);
    return {
      path: asset.id,
      name: asset.name,
      type: 'file',
      detail: asset.host,
      context: { assetId: asset.id, assetType: this.type },
    };
  }

  async execute(record: AssetRecord, request: AssetRequest): Promise<void> {
    const asset = requireSshConfiguration(record);
    if (request.action === 'sftp') {
      await vscode.commands.executeCommand('toolkit.sftp.open', asset.id);
      return;
    }
    if (request.action !== 'connect') throw new Error('Unsupported SSH operation.');
    const credentials = await this.credentials.list();
    const credential = credentials.find((c) => c.id === asset.credentialId);
    if (!credential) throw new Error('Credential not found.');
    if (!credential.username) throw new Error('SSH username is required.');
    if (credential.type === 'password' && !credential.password) throw new Error('SSH password is required.');
    if (credential.type === 'privateKey' && !credential.privateKey) throw new Error('SSH private key is required.');
    const pty = new SshPseudoterminal(() => this.connectClient(asset.id));
    const terminal = vscode.window.createTerminal({
      name: formatTabTitle(asset.name, record.folder),
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

  async requireAiAccess(assetId: string): Promise<string> {
    requireSshConfiguration(await this.assets.requireAiAsset(assetId));
    return assetId;
  }

  async validateProxyChain(assetId: string, proxyAssetIds: string[] = []): Promise<void> {
    const visit = async (ids: string[], ancestors: Set<string>): Promise<void> => {
      for (const id of ids) {
        if (ancestors.has(id)) throw new Error('SSH proxy chain contains a cycle.');
        const proxy = requireSshConfiguration(await this.assets.get(id));
        await visit(proxy.proxyAssetIds ?? [], new Set(ancestors).add(id));
      }
    };
    await visit(proxyAssetIds, new Set([assetId]));
  }

  dispose(): void {
    for (const close of this.tunnels) close();
    this.closed.dispose();
    this.invalidate();
  }
}

class SshPseudoterminal implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  readonly onDidWrite = this.writeEmitter.event;
  private session?: SshClientSession;
  private channel?: ClientChannel;
  private dimensions: vscode.TerminalDimensions = { columns: 80, rows: 24 };
  private closed = false;
  private ended = false;

  constructor(private readonly connectClient: () => Promise<SshClientSession>) {}

  open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    if (initialDimensions) this.dimensions = initialDimensions;
    this.connect();
  }

  close(): void {
    this.closed = true;
    this.channel?.close();
    this.session?.close();
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
    void this.connectClient()
      .then((session) => {
        if (this.closed) return session.close();
        this.session = session;
        session.client.on('error', (error) => this.showError(error));
        session.client.once('close', () => this.finish());
        session.client.shell(
          {
            term: 'xterm-256color',
            cols: this.dimensions.columns,
            rows: this.dimensions.rows,
          },
          (error, channel) => {
            if (error) return this.showError(error);
            if (this.closed) {
              session.close();
              return channel.close();
            }
            this.channel = channel;
            channel.on('data', (data: Buffer) => this.writeEmitter.fire(data.toString('utf8')));
            channel.stderr.on('data', (data: Buffer) => this.writeEmitter.fire(data.toString('utf8')));
            channel.on('close', () => this.finish());
          },
        );
      })
      .catch((error: unknown) => this.showError(error instanceof Error ? error : new Error(String(error))));
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
    this.session?.close();
    this.session = undefined;
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
    typeof asset.credentialId !== 'string' ||
    (asset.proxyAssetIds !== undefined &&
      (!Array.isArray(asset.proxyAssetIds) ||
        !asset.proxyAssetIds.every((id) => typeof id === 'string' && id.trim().length > 0)))
  )
    throw new Error(`Invalid SSH configuration: ${value.name}`);
  return value as SshConnectionConfiguration;
}
