import { existsSync, lstatSync, watch as watchFileSystem, type FSWatcher } from 'node:fs';
import { lstat, mkdir, readFile, readdir, rename, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { resolveStorageDirectory } from '@/host/utils/storage';
import { TEMP_FILE_SYSTEM_SCHEME } from './protocol';
import { resolveTempFileSystemPath } from './service';

export function createTempFileUri(relativePath: string): vscode.Uri {
  const uriPath = relativePath.replaceAll('\\', '/').replace(/^\/+/, '');
  return vscode.Uri.from({ scheme: TEMP_FILE_SYSTEM_SCHEME, path: `/${uriPath}` });
}

export function registerTempFileSystem(context: vscode.ExtensionContext): vscode.Disposable {
  const provider = new TempFileSystemProvider(() => resolveStorageDirectory(context, 'temp'));
  const registration = vscode.workspace.registerFileSystemProvider(TEMP_FILE_SYSTEM_SCHEME, provider);
  return new vscode.Disposable(() => {
    registration.dispose();
    provider.dispose();
  });
}

class TempFileSystemProvider implements vscode.FileSystemProvider, vscode.Disposable {
  private readonly fileChangeEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private readonly watchers = new Set<FSWatcher>();
  private disposed = false;
  readonly onDidChangeFile = this.fileChangeEmitter.event;

  constructor(private readonly getTempDirectory: () => string) {}

  watch(uri: vscode.Uri, options: { recursive: boolean; excludes: readonly string[] }): vscode.Disposable {
    if (this.disposed) return new vscode.Disposable(() => {});
    const storagePath = this.getStoragePath(uri);
    let isDirectory = false;
    try {
      isDirectory = lstatSync(storagePath).isDirectory();
    } catch {
      return new vscode.Disposable(() => {});
    }

    const watchedPath = isDirectory ? storagePath : path.dirname(storagePath);
    let watcher: FSWatcher;
    try {
      watcher = watchFileSystem(watchedPath, { recursive: isDirectory && options.recursive }, (eventType, filename) => {
        if (this.disposed) return;
        const changedPath = filename ? path.resolve(watchedPath, filename.toString()) : storagePath;
        if (!isDirectory && changedPath !== storagePath) return;

        const changedUri = this.createUriForStoragePath(changedPath);
        if (!changedUri) return;

        const type =
          eventType === 'rename'
            ? existsSync(changedPath)
              ? vscode.FileChangeType.Created
              : vscode.FileChangeType.Deleted
            : vscode.FileChangeType.Changed;
        this.fireChange(type, changedUri);
      });
    } catch {
      return new vscode.Disposable(() => {});
    }

    this.watchers.add(watcher);
    watcher.on('close', () => this.watchers.delete(watcher));
    watcher.on('error', () => watcher.close());
    return new vscode.Disposable(() => watcher.close());
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    return this.withFileSystemErrors(uri, async () => {
      const storagePath = this.getStoragePath(uri);
      if (this.isStorageRoot(storagePath)) await mkdir(storagePath, { recursive: true });

      const stats = await lstat(storagePath);
      const type = stats.isDirectory() ? vscode.FileType.Directory : stats.isFile() ? vscode.FileType.File : undefined;
      if (type === undefined) throw vscode.FileSystemError.FileNotFound(uri);

      return { type, ctime: stats.birthtimeMs, mtime: stats.mtimeMs, size: stats.size };
    });
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    return this.withFileSystemErrors(uri, async () => {
      const storagePath = this.getStoragePath(uri);
      if (this.isStorageRoot(storagePath)) await mkdir(storagePath, { recursive: true });
      const stats = await lstat(storagePath);
      if (!stats.isDirectory()) throw vscode.FileSystemError.FileNotADirectory(uri);

      const entries = await readdir(storagePath, { withFileTypes: true });
      return entries.flatMap((entry): [string, vscode.FileType][] => {
        if (entry.isDirectory()) return [[entry.name, vscode.FileType.Directory]];
        if (entry.isFile()) return [[entry.name, vscode.FileType.File]];
        return [];
      });
    });
  }

  async createDirectory(uri: vscode.Uri): Promise<void> {
    return this.withFileSystemErrors(uri, async () => {
      const storagePath = this.getStoragePath(uri);
      const existingStats = await this.getStatsIfExists(storagePath);
      if (existingStats) {
        if (existingStats.isDirectory()) return;
        throw vscode.FileSystemError.FileExists(uri);
      }

      await mkdir(storagePath, { recursive: this.isStorageRoot(storagePath) });
      this.fireChange(vscode.FileChangeType.Created, uri);
    });
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    return this.withFileSystemErrors(uri, async () => {
      const storagePath = this.getStoragePath(uri);
      const stats = await lstat(storagePath);
      if (stats.isDirectory()) throw vscode.FileSystemError.FileIsADirectory(uri);
      if (!stats.isFile()) throw vscode.FileSystemError.FileNotFound(uri);
      return readFile(storagePath);
    });
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean },
  ): Promise<void> {
    return this.withFileSystemErrors(uri, async () => {
      const storagePath = this.getStoragePath(uri);
      if (this.isStorageRoot(storagePath)) throw vscode.FileSystemError.FileIsADirectory(uri);

      const existingStats = await this.getStatsIfExists(storagePath);
      if (!existingStats && !options.create) throw vscode.FileSystemError.FileNotFound(uri);
      if (existingStats && !options.overwrite) throw vscode.FileSystemError.FileExists(uri);
      if (existingStats && existingStats.isDirectory()) throw vscode.FileSystemError.FileIsADirectory(uri);
      if (existingStats && !existingStats.isFile()) throw vscode.FileSystemError.NoPermissions(uri);

      await writeFile(storagePath, content, { flag: existingStats ? 'w' : 'wx' });
      this.fireChange(existingStats ? vscode.FileChangeType.Changed : vscode.FileChangeType.Created, uri);
    });
  }

  async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
    return this.withFileSystemErrors(uri, async () => {
      const storagePath = this.getStoragePath(uri);
      if (this.isStorageRoot(storagePath)) throw vscode.FileSystemError.NoPermissions(uri);

      const stats = await lstat(storagePath);
      if (stats.isSymbolicLink()) throw vscode.FileSystemError.NoPermissions(uri);
      if (stats.isDirectory()) {
        if (options.recursive) await rm(storagePath, { recursive: true });
        else await rmdir(storagePath);
      } else if (stats.isFile()) {
        await unlink(storagePath);
      } else {
        throw vscode.FileSystemError.NoPermissions(uri);
      }
      this.fireChange(vscode.FileChangeType.Deleted, uri);
    });
  }

  async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
    return this.withFileSystemErrors(oldUri, async () => {
      const oldPath = this.getStoragePath(oldUri);
      const newPath = this.getStoragePath(newUri);
      if (this.isStorageRoot(oldPath) || this.isStorageRoot(newPath)) {
        throw vscode.FileSystemError.NoPermissions(oldUri);
      }
      if (oldPath === newPath) return;

      const oldStats = await lstat(oldPath);
      if (oldStats.isSymbolicLink() || (!oldStats.isFile() && !oldStats.isDirectory())) {
        throw vscode.FileSystemError.NoPermissions(oldUri);
      }

      const newStats = await this.getStatsIfExists(newPath);
      if (newStats && !options.overwrite) throw vscode.FileSystemError.FileExists(newUri);
      if (newStats?.isDirectory()) await rm(newPath, { recursive: true });
      else if (newStats) await unlink(newPath);

      await rename(oldPath, newPath);
      this.fileChangeEmitter.fire([
        { type: vscode.FileChangeType.Deleted, uri: oldUri },
        { type: vscode.FileChangeType.Created, uri: newUri },
      ]);
    });
  }

  dispose(): void {
    this.disposed = true;
    for (const watcher of this.watchers) watcher.close();
    this.watchers.clear();
    this.fileChangeEmitter.dispose();
  }

  private getStoragePath(uri: vscode.Uri): string {
    if (uri.scheme !== TEMP_FILE_SYSTEM_SCHEME || uri.authority || uri.query || uri.fragment) {
      throw vscode.FileSystemError.NoPermissions(uri);
    }

    try {
      return resolveTempFileSystemPath(this.getTempDirectory(), uri.path);
    } catch {
      throw vscode.FileSystemError.NoPermissions(uri);
    }
  }

  private isStorageRoot(storagePath: string): boolean {
    return path.resolve(storagePath) === path.resolve(this.getTempDirectory());
  }

  private async getStatsIfExists(storagePath: string) {
    try {
      return await lstat(storagePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }

  private createUriForStoragePath(storagePath: string): vscode.Uri | undefined {
    const rootPath = path.resolve(this.getTempDirectory());
    const relativePath = path.relative(rootPath, storagePath);
    if (
      !relativePath ||
      relativePath === '..' ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      return undefined;
    }
    return createTempFileUri(relativePath);
  }

  private fireChange(type: vscode.FileChangeType, uri: vscode.Uri): void {
    this.fileChangeEmitter.fire([{ type, uri }]);
  }

  private async withFileSystemErrors<T>(uri: vscode.Uri, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      throw toFileSystemError(error, uri);
    }
  }
}

function toFileSystemError(error: unknown, uri: vscode.Uri): vscode.FileSystemError {
  if (error instanceof vscode.FileSystemError) return error;

  const code = (error as NodeJS.ErrnoException).code;
  switch (code) {
    case 'ENOENT':
      return vscode.FileSystemError.FileNotFound(uri);
    case 'EEXIST':
      return vscode.FileSystemError.FileExists(uri);
    case 'ENOTDIR':
      return vscode.FileSystemError.FileNotADirectory(uri);
    case 'EISDIR':
      return vscode.FileSystemError.FileIsADirectory(uri);
    case 'EACCES':
    case 'EPERM':
      return vscode.FileSystemError.NoPermissions(uri);
    default:
      return vscode.FileSystemError.Unavailable(error instanceof Error ? error.message : String(error));
  }
}
