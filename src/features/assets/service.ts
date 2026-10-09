import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, unlink, writeFile, lstat } from 'node:fs/promises';
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

    const traverse = async (dir: string, parentId?: string) => {
      const files = await readdir(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory()) {
          const folderId = parentId ? `${parentId}/${file.name}` : file.name;
          entries.push({ id: folderId, type: 'folder', name: file.name, parentId });
          await traverse(path.join(dir, file.name), folderId);
        } else if (file.isFile() && file.name.endsWith('.json')) {
          try {
            const value: any = JSON.parse(await readFile(path.join(dir, file.name), 'utf8'));
            if (value && typeof value === 'object' && typeof value.id === 'string' && typeof value.type === 'string') {
              value.name = file.name.slice(0, -5);
              value.parentId = parentId;
              entries.push(value);
            }
          } catch {
            // Ignore invalid files
          }
        }
      }
    };

    await traverse(this.directory);
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

    const dir = parentId ? path.join(this.directory, parentId) : this.directory;
    const target = path.join(dir, trimmed);

    try {
      await lstat(target);
      throw new Error('An asset or folder with this name already exists.');
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e;
    }

    await mkdir(target, { recursive: true });
  }

  async save(asset: AssetRecord): Promise<void> {
    if (!isAssetRecord(asset)) throw new Error('Invalid asset.');

    const existing = await this.get(asset.id).catch(() => undefined);

    const dir = asset.parentId ? path.join(this.directory, asset.parentId) : this.directory;
    await mkdir(dir, { recursive: true });

    const target = path.join(dir, `${asset.name}.json`);

    if (existing) {
      const oldDir = existing.parentId ? path.join(this.directory, existing.parentId) : this.directory;
      const oldTarget = path.join(oldDir, `${existing.name}.json`);
      if (oldTarget !== target) {
        try {
          await lstat(target);
          throw new Error('An asset with this name already exists.');
        } catch (e: any) {
          if (e.code !== 'ENOENT') throw e;
        }
        await rename(oldTarget, target);
      }
    } else {
      try {
        await lstat(target);
        throw new Error('An asset with this name already exists.');
      } catch (e: any) {
        if (e.code !== 'ENOENT') throw e;
      }
    }

    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      const { name: _name, parentId: _parentId, ...rest } = asset as any;
      await writeFile(temporary, JSON.stringify(rest, null, 2), { mode: 0o600 });
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  async delete(asset: AssetRecord): Promise<void> {
    if (asset.type !== 'folder' && !isAssetRecord(asset)) throw new Error('Invalid asset.');

    if (asset.type === 'folder') {
      const target = asset.id ? path.join(this.directory, asset.id) : this.directory;
      const entries = await this.list();
      const toDelete = entries.filter(
        (e) => e.id === asset.id || e.parentId?.startsWith(asset.id + '/') || e.parentId === asset.id,
      );
      for (const entry of toDelete) {
        if (entry.type !== 'folder') {
          await this.context.secrets.delete(this.secretKey(entry));
        }
      }
      await rm(target, { recursive: true, force: true });
    } else {
      const dir = asset.parentId ? path.join(this.directory, asset.parentId) : this.directory;
      const target = path.join(dir, `${asset.name}.json`);
      await unlink(target);
      await this.context.secrets.delete(this.secretKey(asset));
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
    asset.name.trim().length > 0
  );
}
