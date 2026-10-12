import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, unlink, writeFile, lstat } from 'node:fs/promises';
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
              entries.push({ ...value, folder: folder || undefined });
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

  async listFolders(): Promise<string[]> {
    await mkdir(this.directory, { recursive: true });
    const folders: string[] = [];
    const traverse = async (dir: string) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const folder = path.join(dir, entry.name);
        folders.push(path.relative(this.directory, folder).split(path.sep).join('/'));
        await traverse(folder);
      }
    };
    await traverse(this.directory);
    return folders.sort((first, second) => first.localeCompare(second));
  }

  async get(id: string): Promise<AssetRecord> {
    const asset = (await this.list()).find((entry) => entry.id === id);
    if (!asset) throw new Error('Asset no longer exists.');
    return asset;
  }

  async save(asset: AssetRecord): Promise<void> {
    if (!isAssetRecord(asset)) throw new Error('Invalid asset.');

    const existing = await this.get(asset.id).catch(() => undefined);
    const folder = asset.folder ?? existing?.folder;
    const savedAsset = folder ? { ...asset, folder } : { ...asset, folder: undefined };
    const targetDirectory = folder ? await this.resolveFolder(folder) : this.directory;
    await mkdir(targetDirectory, { recursive: true });

    const duplicate = (await this.list()).find((entry) => entry.id !== asset.id && entry.name === asset.name);
    if (duplicate) throw new Error('An asset with this name already exists.');

    const target = path.join(targetDirectory, `${asset.id}.json`);

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
      await writeFile(temporary, JSON.stringify(savedAsset, null, 2), { mode: 0o600 });
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

  async createFolder(name: string, parentFolder?: string): Promise<void> {
    const folderName = name.trim();
    if (!folderName || folderName === '.' || folderName === '..' || /[\\/\0]/.test(folderName)) {
      throw new Error('Enter a valid asset folder name.');
    }
    await mkdir(this.directory, { recursive: true });
    const parent = parentFolder ? await this.resolveFolder(parentFolder) : this.directory;
    await mkdir(path.join(parent, folderName));
  }

  async moveAsset(id: string, destinationFolder?: string): Promise<void> {
    await this.get(id);
    const source = await this.findRecordPath(id);
    if (!source) throw new Error('Asset no longer exists.');
    const targetDirectory = destinationFolder ? await this.resolveFolder(destinationFolder) : this.directory;
    const target = path.join(targetDirectory, `${id}.json`);
    if (source === target) return;
    if (await pathExists(target)) throw new Error('An asset with this name already exists in that folder.');
    await rename(source, target);
  }

  async moveFolder(folder: string, destinationFolder?: string): Promise<void> {
    const source = await this.resolveFolder(folder);
    if (destinationFolder && (destinationFolder === folder || destinationFolder.startsWith(`${folder}/`))) {
      throw new Error('A folder cannot be moved into itself.');
    }
    const targetDirectory = destinationFolder ? await this.resolveFolder(destinationFolder) : this.directory;
    const currentParent = path.posix.dirname(folder);
    if ((currentParent === '.' ? undefined : currentParent) === destinationFolder) return;
    const target = path.join(targetDirectory, path.basename(source));
    if (await pathExists(target)) throw new Error('A folder with this name already exists there.');
    await rename(source, target);
  }

  async renameFolder(folder: string, rawName: string): Promise<void> {
    const name = rawName.trim();
    if (!isValidFolderName(name)) throw new Error('Enter a valid folder name.');
    const source = await this.resolveFolder(folder);
    if (path.posix.basename(folder) === name) return;
    const parentFolder = path.posix.dirname(folder);
    const parent = parentFolder === '.' ? this.directory : await this.resolveFolder(parentFolder);
    const target = path.join(parent, name);
    if (await pathExists(target)) {
      const [sourceStats, targetStats] = await Promise.all([lstat(source), lstat(target)]);
      if (sourceStats.dev !== targetStats.dev || sourceStats.ino !== targetStats.ino) {
        throw new Error(`"${name}" already exists in this folder.`);
      }
    }
    await rename(source, target);
  }

  async deleteFolder(folder: string): Promise<AssetRecord[]> {
    const target = await this.resolveFolder(folder);
    const assets = (await this.list()).filter(
      (asset) => asset.folder === folder || asset.folder?.startsWith(`${folder}/`),
    );
    for (const asset of assets) await this.delete(asset);
    await rm(target, { recursive: true });
    return assets;
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

  private async resolveFolder(folder: string): Promise<string> {
    if (
      !folder ||
      folder.startsWith('/') ||
      folder.split('/').some((segment) => !segment || segment === '.' || segment === '..' || /[\\\0]/.test(segment))
    ) {
      throw new Error('Invalid asset folder path.');
    }
    let target = path.resolve(this.directory);
    for (const segment of folder.split('/')) {
      target = path.join(target, segment);
      let stats;
      try {
        stats = await lstat(target);
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
          throw new Error('Asset folder no longer exists.');
        }
        throw error;
      }
      if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error('Invalid asset folder path.');
    }
    return target;
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

function isValidFolderName(name: string): boolean {
  return Boolean(name.trim()) && name !== '.' && name !== '..' && !/[\\/\0]/.test(name);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
