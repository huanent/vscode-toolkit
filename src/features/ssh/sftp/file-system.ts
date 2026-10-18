import { promisify } from 'node:util';
import * as vscode from 'vscode';
import type { SshService } from '@/features/ssh/ssh-service';

const scheme = 'toolkit-sftp';

export function createSftpFileUri(assetId: string, path: string): vscode.Uri {
  return vscode.Uri.from({ scheme, authority: assetId, path });
}

export function registerSftpFileSystem(context: vscode.ExtensionContext, ssh: SshService): void {
  const provider = new SftpFileSystemProvider(ssh);
  context.subscriptions.push(
    provider,
    vscode.workspace.registerFileSystemProvider(scheme, provider, {
      isCaseSensitive: true,
    }),
  );
}

class SftpFileSystemProvider implements vscode.FileSystemProvider, vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private readonly cancellation = new AbortController();
  readonly onDidChangeFile = this.changes.event;

  constructor(private readonly ssh: SshService) {}

  watch(): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    return this.ssh.withSftp(uri.authority, this.cancellation.signal, async (sftp) => {
      const stat = await promisify(sftp.stat.bind(sftp))(uri.path);
      return {
        type: stat.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
        ctime: 0,
        mtime: stat.mtime * 1000,
        size: stat.size,
      };
    });
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    return this.ssh.withSftp(uri.authority, this.cancellation.signal, async (sftp) => {
      const stat = await promisify(sftp.stat.bind(sftp))(uri.path);
      if (!stat.isFile()) throw vscode.FileSystemError.FileIsADirectory(uri);
      if (stat.size > 10 * 1024 * 1024) throw new Error('Download files larger than 10 MB to open them locally.');
      const buffer = await promisify(sftp.readFile.bind(sftp))(uri.path);
      if (buffer.includes(0)) throw new Error('Download binary files to open them locally.');
      return buffer;
    });
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean },
  ): Promise<void> {
    await this.ssh.withSftp(uri.authority, this.cancellation.signal, async (sftp) => {
      if (!options.overwrite) throw vscode.FileSystemError.FileExists(uri);
      const handle = await promisify(sftp.open.bind(sftp))(uri.path, 'r+');
      try {
        const stat = await promisify(sftp.fstat.bind(sftp))(handle);
        if (!stat.isFile()) throw vscode.FileSystemError.NoPermissions('Only regular files can be edited.');
        const buffer = Buffer.from(content);
        await new Promise<void>((resolve, reject) => {
          if (!buffer.length) return resolve();
          sftp.write(handle, buffer, 0, buffer.length, 0, (error) => (error ? reject(error) : resolve()));
        });
        await promisify(sftp.fsetstat.bind(sftp))(handle, { size: buffer.length });
        const updated = await promisify(sftp.fstat.bind(sftp))(handle);
        if ((updated.mode & 0o7777) !== (stat.mode & 0o7777)) {
          await promisify(sftp.fchmod.bind(sftp))(handle, stat.mode & 0o7777);
          const restored = await promisify(sftp.fstat.bind(sftp))(handle);
          if ((restored.mode & 0o7777) !== (stat.mode & 0o7777))
            throw new Error('File content was saved, but the original permissions could not be restored.');
        }
      } finally {
        await promisify(sftp.close.bind(sftp))(handle);
      }
    });
    this.changes.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  readDirectory(): [string, vscode.FileType][] {
    throw vscode.FileSystemError.NoPermissions('Use the SFTP panel to browse directories.');
  }

  createDirectory(): void {
    throw vscode.FileSystemError.NoPermissions('Use the SFTP panel to create directories.');
  }

  delete(): void {
    throw vscode.FileSystemError.NoPermissions('Use the SFTP panel to delete files.');
  }

  rename(): void {
    throw vscode.FileSystemError.NoPermissions('Use the SFTP panel to rename files.');
  }

  dispose(): void {
    this.cancellation.abort();
    this.changes.dispose();
  }
}
