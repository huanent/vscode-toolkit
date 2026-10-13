import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, unlink, writeFile, lstat } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { resolveStorageRoots } from '@/host/utils/storage';
import { findStorageRoot, type StorageRoot, type StorageScope } from '@/shared/storage-scope';

export interface AssetRecord {
  id: string;
  type: string;
  name: string;
  folder?: string;
  enableAI?: boolean;
  scope?: StorageScope;
}

export class AssetService {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async list(): Promise<AssetRecord[]> {
    const entries: AssetRecord[] = [];

    for (const root of await this.existingRoots()) {
      const traverse = async (dir: string) => {
        const files = await readdir(dir, { withFileTypes: true });
        for (const file of files) {
          if (file.isDirectory()) {
            await traverse(path.join(dir, file.name));
          } else if (file.isFile() && file.name.endsWith('.json')) {
            try {
              const value: any = JSON.parse(await readFile(path.join(dir, file.name), 'utf8'));
              if (
                value &&
                typeof value === 'object' &&
                typeof value.id === 'string' &&
                typeof value.type === 'string'
              ) {
                if (typeof value.name !== 'string') value.name = file.name.slice(0, -5);
                const folder = path.relative(root.directory, dir).split(path.sep).join('/');
                entries.push({ ...value, folder: folder || undefined, scope: root.scope });
              }
            } catch {
              // Ignore invalid files
            }
          }
        }
      };
      await traverse(root.directory);
    }
    return entries.sort((first, second) => first.name.localeCompare(second.name));
  }

  async listFolders(): Promise<string[]> {
    const folders = new Set<string>();
    for (const root of await this.existingRoots()) {
      const traverse = async (dir: string) => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const folder = path.join(dir, entry.name);
          folders.add(path.relative(root.directory, folder).split(path.sep).join('/'));
          await traverse(folder);
        }
      };
      await traverse(root.directory);
    }
    return [...folders].sort((first, second) => first.localeCompare(second));
  }

  async get(id: string): Promise<AssetRecord> {
    const asset = (await this.list()).find((entry) => entry.id === id);
    if (!asset) throw new Error('Asset no longer exists.');
    return asset;
  }

  async requireAiAsset(id: string): Promise<AssetRecord> {
    const asset = await this.get(id);
    if (!isAiEnabled(asset)) throw new Error('Asset access is disabled.');
    return asset;
  }

  async save(asset: AssetRecord): Promise<void> {
    if (!isAssetRecord(asset)) throw new Error('Invalid asset.');

    const existing = await this.get(asset.id).catch(() => undefined);
    const folder = asset.folder ?? existing?.folder;
    const scope = asset.scope ?? existing?.scope ?? 'global';
    const savedAsset: AssetRecord = { ...asset, folder: folder || undefined };
    delete savedAsset.scope;
    const targetDirectory = await this.prepareFolder(scope, folder);

    if (await this.hasNameConflict(asset.id, asset.name, folder)) {
      throw new Error('An asset with this name already exists in that folder.');
    }

    const current = await this.findRecord(asset.id);
    const target = path.join(targetDirectory, `${asset.id}.json`);
    if (current?.path !== target && (await pathExists(target))) {
      throw new Error('An asset with this name already exists.');
    }

    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(savedAsset, null, 2), { mode: 0o600 });
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }

    if (current && current.path !== target) await unlink(current.path);
    if (current && current.scope !== scope) {
      const previousKey = this.secretKey(asset.type, asset.id, current.scope);
      const secret = await this.context.secrets.get(previousKey);
      if (secret !== undefined) await this.context.secrets.store(this.secretKey(asset.type, asset.id, scope), secret);
      await this.context.secrets.delete(previousKey);
    }
  }

  async copyName(asset: AssetRecord): Promise<string> {
    const names = new Set(
      (await this.list()).filter((entry) => (entry.folder ?? '') === (asset.folder ?? '')).map((entry) => entry.name),
    );
    let name = `${asset.name} copy`;
    for (let index = 2; names.has(name); index++) name = `${asset.name} copy ${index}`;
    return name;
  }

  async delete(asset: AssetRecord): Promise<void> {
    if (!isAssetRecord(asset)) throw new Error('Invalid asset.');
    const current = await this.findRecord(asset.id);
    if (!current) throw new Error('Asset no longer exists.');
    await unlink(current.path);
    await this.context.secrets.delete(this.secretKey(asset.type, asset.id, current.scope));
  }

  async createFolder(name: string, parentFolder?: string): Promise<void> {
    const folderName = name.trim();
    if (!isValidFolderName(folderName)) throw new Error('Enter a valid asset folder name.');
    const [globalRoot] = this.roots();
    await mkdir(globalRoot.directory, { recursive: true });
    const parent = parentFolder ? (await this.folderLocations(parentFolder))[0]?.directory : globalRoot.directory;
    if (!parent) throw new Error('Asset folder no longer exists.');
    await mkdir(path.join(parent, folderName));
  }

  async moveAsset(id: string, destinationFolder?: string): Promise<void> {
    const source = await this.findRecord(id);
    if (!source) throw new Error('Asset no longer exists.');
    const targetDirectory = await this.prepareFolder(source.scope, destinationFolder);
    const target = path.join(targetDirectory, `${id}.json`);
    if (source.path === target) return;
    const asset = await this.get(id);
    if (await this.hasNameConflict(id, asset.name, destinationFolder)) {
      throw new Error('An asset with this name already exists in that folder.');
    }
    if (await pathExists(target)) throw new Error('An asset with this name already exists in that folder.');
    await rename(source.path, target);
  }

  async moveFolder(folder: string, destinationFolder?: string): Promise<void> {
    const sources = await this.folderLocations(folder);
    if (!sources.length) throw new Error('Asset folder no longer exists.');
    if (destinationFolder && (destinationFolder === folder || destinationFolder.startsWith(`${folder}/`))) {
      throw new Error('A folder cannot be moved into itself.');
    }
    const currentParent = path.posix.dirname(folder);
    if ((currentParent === '.' ? undefined : currentParent) === destinationFolder) return;
    if (destinationFolder && !(await this.folderLocations(destinationFolder)).length) {
      throw new Error('Asset folder no longer exists.');
    }
    const moves = sources.map(({ root, directory }) => {
      const destination = destinationFolder ? folderPath(root.directory, destinationFolder) : root.directory;
      return { source: directory, destination, target: path.join(destination, path.basename(directory)) };
    });
    for (const move of moves) {
      if (await pathExists(move.target)) throw new Error('A folder with this name already exists there.');
    }
    for (const move of moves) {
      await mkdir(move.destination, { recursive: true });
      await rename(move.source, move.target);
    }
  }

  async renameFolder(folder: string, rawName: string): Promise<void> {
    const name = rawName.trim();
    if (!isValidFolderName(name)) throw new Error('Enter a valid folder name.');
    const sources = await this.folderLocations(folder);
    if (!sources.length) throw new Error('Asset folder no longer exists.');
    if (path.posix.basename(folder) === name) return;
    const moves = sources.map(({ directory }) => ({
      source: directory,
      target: path.join(path.dirname(directory), name),
    }));
    for (const move of moves) {
      if (await pathExists(move.target)) {
        const [sourceStats, targetStats] = await Promise.all([lstat(move.source), lstat(move.target)]);
        if (sourceStats.dev !== targetStats.dev || sourceStats.ino !== targetStats.ino) {
          throw new Error(`"${name}" already exists in this folder.`);
        }
      }
    }
    for (const move of moves) await rename(move.source, move.target);
  }

  async deleteFolder(folder: string): Promise<AssetRecord[]> {
    const targets = await this.folderLocations(folder);
    if (!targets.length) throw new Error('Asset folder no longer exists.');
    const assets = (await this.list()).filter(
      (asset) => asset.folder === folder || asset.folder?.startsWith(`${folder}/`),
    );
    for (const asset of assets) await this.delete(asset);
    for (const { directory } of targets) await rm(directory, { recursive: true });
    return assets;
  }

  getSecret(asset: AssetRecord): Thenable<string | undefined> {
    return this.context.secrets.get(this.secretKey(asset.type, asset.id, asset.scope ?? 'global'));
  }

  setSecret(asset: AssetRecord, secret: string): Thenable<void> {
    return this.context.secrets.store(this.secretKey(asset.type, asset.id, asset.scope ?? 'global'), secret);
  }

  private roots(): StorageRoot[] {
    return resolveStorageRoots(this.context, 'assets');
  }

  private async existingRoots(): Promise<StorageRoot[]> {
    const existing: StorageRoot[] = [];
    for (const root of this.roots()) {
      if (await pathExists(root.directory)) existing.push(root);
    }
    return existing;
  }

  private async folderLocations(folder: string): Promise<{ root: StorageRoot; directory: string }[]> {
    validateFolderPath(folder);
    const locations: { root: StorageRoot; directory: string }[] = [];
    for (const root of this.roots()) {
      if (await isRealFolder(root.directory, folder)) {
        locations.push({ root, directory: folderPath(root.directory, folder) });
      }
    }
    return locations;
  }

  private async prepareFolder(scope: StorageScope, folder?: string): Promise<string> {
    const root = findStorageRoot(this.roots(), scope);
    if (!folder) {
      await mkdir(root.directory, { recursive: true });
      return root.directory;
    }
    if (!(await this.folderLocations(folder)).length) throw new Error('Asset folder no longer exists.');
    const directory = folderPath(root.directory, folder);
    await mkdir(directory, { recursive: true });
    return directory;
  }

  private async hasNameConflict(id: string, name: string, folder?: string): Promise<boolean> {
    return (await this.list()).some(
      (entry) => entry.id !== id && entry.name === name && (entry.folder ?? '') === (folder ?? ''),
    );
  }

  private async findRecord(id: string): Promise<{ path: string; scope: StorageScope } | undefined> {
    for (const root of await this.existingRoots()) {
      const recordPath = await findRecordIn(root.directory, id);
      if (recordPath) return { path: recordPath, scope: root.scope };
    }
    return undefined;
  }

  private secretKey(type: string, id: string, scope: StorageScope): string {
    return `${type}:${findStorageRoot(this.roots(), scope).directory}:${id}`;
  }
}

export function isAiEnabled(asset: AssetRecord): boolean {
  return asset.enableAI !== false;
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

function validateFolderPath(folder: string): void {
  if (
    !folder ||
    folder.startsWith('/') ||
    folder.split('/').some((segment) => !segment || segment === '.' || segment === '..' || /[\\\0]/.test(segment))
  ) {
    throw new Error('Invalid asset folder path.');
  }
}

function folderPath(rootDirectory: string, folder: string): string {
  return path.join(rootDirectory, ...folder.split('/'));
}

async function isRealFolder(rootDirectory: string, folder: string): Promise<boolean> {
  let target = rootDirectory;
  for (const segment of folder.split('/')) {
    target = path.join(target, segment);
    try {
      const stats = await lstat(target);
      if (!stats.isDirectory() || stats.isSymbolicLink()) return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }
  return true;
}

async function findRecordIn(dir: string, id: string): Promise<string | undefined> {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      const result = await findRecordIn(filePath, id);
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
