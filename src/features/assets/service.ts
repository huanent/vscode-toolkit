import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, unlink, writeFile, lstat } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { resolveStorageDirectory } from '@/host/utils/storage';

export interface AssetRecord {
  id: string;
  type: string;
  name: string;
  folder?: string;
}

export class AssetService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async list(): Promise<AssetRecord[]> {
    await mkdir(this.directory, { recursive: true });
    const entries: AssetRecord[] = [];

    const traverse = async (dir: string) => {
      const files = await readdir(dir, { withFileTypes: true });
      for (const file of files) {
        if (file.isDirectory()) {
          await traverse(path.join(dir, file.name));
        } else if (file.isFile() && file.name.endsWith('.json')) {
          try {
            const value: any = JSON.parse(await readFile(path.join(dir, file.name), 'utf8'));
            if (value && typeof value === 'object' && typeof value.id === 'string' && typeof value.type === 'string') {
              if (typeof value.name !== 'string') value.name = file.name.slice(0, -5);
              const folder = path.relative(this.directory, dir).split(path.sep).join('/');
              entries.push({ ...value, ...(folder ? { folder } : {}) });
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

  async save(asset: AssetRecord): Promise<void> {
    if (!isAssetRecord(asset)) throw new Error('Invalid asset.');

    const existing = await this.get(asset.id).catch(() => undefined);

    await mkdir(this.directory, { recursive: true });

    const duplicate = (await this.list()).find((entry) => entry.id !== asset.id && entry.name === asset.name);
    if (duplicate) throw new Error('An asset with this name already exists.');

    const target = path.join(this.directory, `${asset.id}.json`);

    if (existing) {
      const oldTarget = (await this.findRecordPath(existing.id)) ?? path.join(this.directory, `${existing.name}.json`);
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
      await writeFile(temporary, JSON.stringify(asset, null, 2), { mode: 0o600 });
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
  }

  async delete(asset: AssetRecord): Promise<void> {
    if (!isAssetRecord(asset)) throw new Error('Invalid asset.');
    const target = (await this.findRecordPath(asset.id)) ?? path.join(this.directory, `${asset.id}.json`);
    await unlink(target);
    await this.context.secrets.delete(this.secretKey(asset));
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

  private async findRecordPath(id: string): Promise<string | undefined> {
    const find = async (dir: string): Promise<string | undefined> => {
      for (const file of await readdir(dir, { withFileTypes: true })) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
          const result = await find(filePath);
          if (result) return result;
        } else if (file.isFile() && file.name.endsWith('.json')) {
          try {
            const value = JSON.parse(await readFile(filePath, 'utf8'));
            if (value && typeof value === 'object' && value.id === id) return filePath;
          } catch {
            // Ignore invalid files
          }
        }
      }
      return undefined;
    };

    return find(this.directory);
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
