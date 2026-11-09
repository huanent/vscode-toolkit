import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { AssetProvider } from '@/features/assets/asset-provider';
import type { AssetFormValues, AssetRequest, AssetViewEntry } from '@/features/assets/protocol';
import type { AssetRecord, AssetService } from '@/features/assets/service';
import type { SshService } from '@/features/ssh/ssh-service';
import type { ContainerInfo, ContainerSettings } from './protocol';
import { containerEditorViewType, createContainerUri } from './editor';

export interface ContainerAsset extends AssetRecord, ContainerSettings {
  type: 'container';
}

const executeFile = promisify(execFile);

export class ContainerService implements AssetProvider {
  readonly type = 'container';
  readonly label = 'Container';
  readonly icon = 'server';
  readonly capabilities = { container: true };

  constructor(
    private readonly assets: AssetService,
    private readonly ssh: SshService,
  ) {}

  getFormValues(record?: AssetRecord): AssetFormValues {
    const asset = record ? requireContainerAsset(record) : undefined;
    return {
      name: asset?.name ?? '',
      description: asset?.description ?? '',
      host: '',
      port: 22,
      database: '',
      tls: false,
      enableAI: record?.enableAI !== false,
      storageScope: record?.scope ?? 'global',
      credentialId: '',
      container: { runtime: asset?.runtime ?? 'docker', cliPath: asset?.cliPath, sshAssetId: asset?.sshAssetId },
    };
  }

  async saveConfiguration(values: AssetFormValues, previous?: AssetRecord, folder?: string): Promise<void> {
    if (!values.container || typeof values.container !== 'object') throw new Error('Container settings are required.');
    const { runtime, cliPath, sshAssetId } = values.container;
    if (cliPath !== undefined && typeof cliPath !== 'string') throw new Error('Invalid CLI path.');
    if (sshAssetId !== undefined && typeof sshAssetId !== 'string') throw new Error('Invalid SSH asset.');
    const asset = requireContainerAsset({
      id: previous?.id ?? randomUUID(),
      type: this.type,
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      folder: previous?.folder ?? folder,
      scope: values.storageScope,
      enableAI: values.enableAI,
      runtime,
      cliPath: cliPath?.trim() || undefined,
      sshAssetId: sshAssetId?.trim() || undefined,
    } as ContainerAsset);
    if (!asset.name) throw new Error('Name is required.');
    if (asset.sshAssetId) await this.ssh.resolveConnectionId(asset.sshAssetId);
    await this.assets.save(asset);
  }

  toViewEntry(record: AssetRecord): AssetViewEntry {
    const asset = requireContainerAsset(record);
    return {
      path: asset.id,
      name: asset.name,
      type: 'file',
      detail: asset.runtime,
      context: { assetId: asset.id, assetType: this.type },
    };
  }

  async execute(record: AssetRecord, request: AssetRequest): Promise<void> {
    if (request.action !== 'connect') return;
    const asset = requireContainerAsset(record);
    await vscode.commands.executeCommand(
      'vscode.openWith',
      createContainerUri(asset.id, asset.name),
      containerEditorViewType,
    );
  }

  async requireAsset(id: string): Promise<ContainerAsset> {
    return requireContainerAsset(await this.assets.get(id));
  }

  async list(id: string): Promise<ContainerInfo[]> {
    const asset = await this.requireAsset(id);
    const args =
      asset.runtime === 'apple'
        ? ['list', '--all', '--format', 'json']
        : ['ps', '--all', '--format', asset.runtime === 'podman' ? 'json' : '{{json .}}'];
    const output = await this.run(asset, args);
    try {
      const data: unknown =
        asset.runtime !== 'docker'
          ? JSON.parse(output.stdout || '[]')
          : output.stdout
              .trim()
              .split('\n')
              .filter(Boolean)
              .map((line) => JSON.parse(line));
      if (!Array.isArray(data)) throw new Error('Expected an array');
      return data.map((item: unknown) => parseContainer(item, asset.runtime === 'apple'));
    } catch (error) {
      throw new Error(
        `Invalid ${asset.runtime} container list output: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async action(assetId: string, action: 'start' | 'stop' | 'restart', id: string): Promise<void> {
    validateId(id);
    const asset = await this.requireAsset(assetId);
    if (asset.runtime === 'apple' && action === 'restart') {
      await this.run(asset, ['stop', id]);
      await this.run(asset, ['start', id]);
    } else await this.run(asset, [action, id]);
  }

  async logs(assetId: string, id: string): Promise<string> {
    validateId(id);
    const asset = await this.requireAsset(assetId);
    const result = await this.run(
      asset,
      asset.runtime === 'apple' ? ['logs', '-n', '1000', id] : ['logs', '--tail', '1000', id],
    );
    return result.stdout + result.stderr;
  }

  private async run(asset: ContainerAsset, args: string[]): Promise<{ stdout: string; stderr: string }> {
    const executable = asset.cliPath || (asset.runtime === 'apple' ? 'container' : asset.runtime);
    if (asset.sshAssetId) {
      const result = await this.ssh.runCommand(asset.sshAssetId, [executable, ...args].map(quoteShell).join(' '));
      if (result.exitCode !== 0)
        throw new Error(result.stderr.trim() || `Container command failed (exit ${result.exitCode ?? 'unknown'}).`);
      if (result.stdout.includes('[Output truncated at '))
        throw new Error('Container command output exceeded the SSH output limit.');
      return result;
    }
    try {
      return await executeFile(executable, args, { maxBuffer: 4 * 1024 * 1024, timeout: 60000, encoding: 'utf8' });
    } catch (error) {
      const failure = error as Error & { stderr?: string };
      throw new Error(failure.stderr?.trim() || failure.message);
    }
  }

  invalidate(): void {}
  dispose(): void {}
}

function requireContainerAsset(record: AssetRecord): ContainerAsset {
  const asset = record as ContainerAsset;
  if (
    asset.type !== 'container' ||
    !['apple', 'docker', 'podman'].includes(asset.runtime) ||
    (asset.cliPath !== undefined &&
      (typeof asset.cliPath !== 'string' || !asset.cliPath.trim() || asset.cliPath.includes('\0'))) ||
    (asset.sshAssetId !== undefined && (typeof asset.sshAssetId !== 'string' || !asset.sshAssetId.trim()))
  ) {
    throw new Error('Invalid container configuration.');
  }
  return asset;
}

function validateId(id: string): void {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(id)) throw new Error('Invalid container ID.');
}

function quoteShell(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function parseContainer(value: unknown, apple: boolean): ContainerInfo {
  if (!value || typeof value !== 'object') throw new Error('Invalid container entry');
  const row = value as Record<string, unknown>;
  if (apple) {
    const config = row.configuration as Record<string, unknown> | undefined;
    const status = row.status as Record<string, unknown> | undefined;
    const image = config?.image as Record<string, unknown> | undefined;
    if (typeof config?.id !== 'string' || typeof status?.state !== 'string')
      throw new Error('Missing container ID or state');
    return {
      id: config.id,
      name: config.id,
      image: typeof image?.reference === 'string' ? image.reference : '',
      state: status.state,
      status: status.state,
    };
  }
  const id = row.ID ?? row.Id;
  const names = row.Names ?? row.Name;
  if (typeof id !== 'string') throw new Error('Missing container ID');
  return {
    id,
    name: Array.isArray(names) ? String(names[0] ?? id) : typeof names === 'string' ? names : id,
    image: typeof row.Image === 'string' ? row.Image : '',
    status: typeof row.Status === 'string' ? row.Status : '',
    state: typeof row.State === 'string' ? row.State : '',
  };
}
