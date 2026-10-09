import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { resolveStorageDirectory } from '@/host/utils/storage';

export interface AssetRecord {
  id: string;
  type: string;
  name: string;
  parentId?: string;
}

export class AssetService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async list(): Promise<AssetRecord[]> {
    await mkdir(this.directory, { recursive: true });
    const entries: AssetRecord[] = [];
    for (const file of await readdir(this.directory)) {
      if (!file.endsWith('.json')) continue;
      const value: unknown = JSON.parse(await readFile(path.join(this.directory, file), 'utf8'));
      if (!isAssetRecord(value) || file !== `${value.id}.${value.type}.json`) {
        throw new Error(`Invalid asset: ${file}`);
      }
      entries.push(value);
    }
    return entries.sort((first, second) => first.name.localeCompare(second.name));
  }

  async get(id: string): Promise<AssetRecord> {
    const asset = (await this.list()).find((entry) => entry.id === id);
    if (!asset) throw new Error('Asset no longer exists.');
    return asset;
  }

  async createFolder(name: string, parentId?: string): Promise<void> {
    const trimmed = name.trim();
    if (
      !trimmed ||
      trimmed === '.' ||
      trimmed === '..' ||
      /[\\/]/.test(trimmed) ||
      Array.from(trimmed).some((character) => character.charCodeAt(0) < 32)
    )
      throw new Error('Enter a valid folder name.');
    const entries = await this.list();
    if (parentId && !entries.some((entry) => entry.id === parentId && entry.type === 'folder'))
      throw new Error('Parent folder no longer exists.');
    if (entries.some((entry) => entry.parentId === parentId && entry.name === trimmed))
      throw new Error('An asset or folder with this name already exists.');
    await this.save({ id: randomUUID(), type: 'folder', name: trimmed, parentId });
  }

  async save(asset: AssetRecord): Promise<void> {
    if (!isAssetRecord(asset)) throw new Error('Invalid asset.');
    if (asset.parentId && !(await this.list()).some((entry) => entry.id === asset.parentId && entry.type === 'folder'))
      throw new Error('Parent folder no longer exists.');
    await mkdir(this.directory, { recursive: true });
    const target = path.join(this.directory, `${asset.id}.${asset.type}.json`);
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(asset, null, 2), { mode: 0o600 });
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  async delete(asset: AssetRecord): Promise<void> {
    if (!isAssetRecord(asset)) throw new Error('Invalid asset.');
    const entries = await this.list();
    const children = new Map<string, AssetRecord[]>();
    for (const entry of entries) {
      if (!entry.parentId) continue;
      const siblings = children.get(entry.parentId) ?? [];
      siblings.push(entry);
      children.set(entry.parentId, siblings);
    }

    const pending = [asset];
    while (pending.length) {
      const entry = pending.pop()!;
      await unlink(path.join(this.directory, `${entry.id}.${entry.type}.json`));
      await this.context.secrets.delete(this.secretKey(entry));
      if (entry.type === 'folder') pending.push(...(children.get(entry.id) ?? []));
    }
  }

  getSecret(asset: AssetRecord): Thenable<string | undefined> {
    return this.context.secrets.get(this.secretKey(asset));
  }

  setSecret(asset: AssetRecord, secret: string): Thenable<void> {
    return this.context.secrets.store(this.secretKey(asset), secret);
  }

  private get directory(): string {
    return resolveStorageDirectory(this.context, 'assets');
  }

  private secretKey(asset: AssetRecord): string {
    return `${asset.type}:${this.directory}:${asset.id}`;
  }
}

function isAssetRecord(value: unknown): value is AssetRecord {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Partial<AssetRecord>;
  return (
    typeof asset.id === 'string' &&
    /^[a-zA-Z0-9-]+$/.test(asset.id) &&
    typeof asset.type === 'string' &&
    /^[a-zA-Z0-9-]+$/.test(asset.type) &&
    typeof asset.name === 'string' &&
    asset.name.trim().length > 0 &&
    (asset.parentId === undefined || (typeof asset.parentId === 'string' && /^[a-zA-Z0-9-]+$/.test(asset.parentId)))
  );
}
