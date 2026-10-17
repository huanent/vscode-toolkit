import * as fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, posix, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { SFTPWrapper } from 'ssh2';
import * as vscode from 'vscode';
import type { SshService } from '@/features/ssh/ssh-service';
import type { SftpDirectory, SftpEntry, SftpSide } from '@/features/ssh/protocol';

export class SftpFileService {
  constructor(
    private readonly ssh: SshService,
    private readonly assetId: string,
    private readonly signal: AbortSignal,
  ) {}

  private remote<T>(run: (sftp: SFTPWrapper) => Promise<T>): Promise<T> {
    this.signal.throwIfAborted();
    return this.ssh.withSftp(this.assetId, this.signal, run);
  }

  async list(side: SftpSide, address?: string, current?: string): Promise<SftpDirectory> {
    if (side === 'local') {
      const path = await fs.realpath(address === '~' ? homedir() : resolve(current ?? homedir(), address ?? '.'));
      const children = await fs.readdir(path, { withFileTypes: true });
      const entries = await Promise.all(
        children
          .filter((entry) => entry.name !== '.DS_Store')
          .map(async (entry) => {
            const child = join(path, entry.name);
            try {
              const stat = await fs.stat(child);
              return {
                path: child,
                name: entry.name,
                type: stat.isDirectory() ? 'directory' : 'file',
                size: stat.isFile() ? stat.size : undefined,
                modifiedAt: stat.mtimeMs,
                symbolicLink: entry.isSymbolicLink(),
              } satisfies SftpEntry;
            } catch {
              return undefined;
            }
          }),
      );
      return { path, parent: dirname(path), entries: entries.filter((entry) => entry !== undefined) };
    }
    return this.remote(async (sftp) => {
      const requested = !address || address === '~' ? '.' : posix.resolve(current ?? '/', address);
      const path = await promisify(sftp.realpath.bind(sftp))(requested);
      const children = await promisify(sftp.readdir.bind(sftp))(path);
      const entries = await Promise.all(
        children
          .filter((entry) => !['.', '..'].includes(entry.filename))
          .map(async (entry): Promise<SftpEntry> => {
            const child = posix.join(path, entry.filename);
            const symbolicLink = entry.attrs.isSymbolicLink();
            const stat = symbolicLink
              ? await promisify(sftp.stat.bind(sftp))(child).catch(() => entry.attrs)
              : entry.attrs;
            return {
              path: child,
              name: entry.filename,
              type: stat.isDirectory() ? 'directory' : 'file',
              size: stat.isFile() ? stat.size : undefined,
              modifiedAt: stat.mtime * 1000,
              symbolicLink,
            };
          }),
      );
      return { path, parent: posix.dirname(path), entries };
    });
  }

  child(side: SftpSide, directory: string, name: string): string {
    return side === 'local' ? join(directory, name) : posix.join(directory, name);
  }

  async create(side: SftpSide, path: string, directory: boolean): Promise<void> {
    if (side === 'local') {
      if (directory) await fs.mkdir(path);
      else await fs.writeFile(path, '', { flag: 'wx' });
    } else
      await this.remote(async (sftp) => {
        if (directory) await promisify(sftp.mkdir.bind(sftp))(path);
        else
          await new Promise<void>((resolve, reject) => {
            sftp.writeFile(path, '', { flag: 'wx' }, (error) => (error ? reject(error) : resolve()));
          });
      });
  }

  async rename(side: SftpSide, source: string, target: string): Promise<void> {
    if (side === 'local') {
      await fs.rename(source, target);
    } else
      await this.remote(async (sftp) => {
        await promisify(sftp.rename.bind(sftp))(source, target);
      });
  }

  async remove(side: SftpSide, path: string): Promise<void> {
    if (side === 'local') {
      await vscode.workspace.fs.delete(vscode.Uri.file(path), { recursive: true, useTrash: true });
      return;
    }
    await this.remote(async (sftp) => {
      const remove = async (target: string): Promise<void> => {
        this.signal.throwIfAborted();
        const stat = await promisify(sftp.lstat.bind(sftp))(target);
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          const entries = await promisify(sftp.readdir.bind(sftp))(target);
          for (const entry of entries) {
            if (!['.', '..'].includes(entry.filename)) await remove(posix.join(target, entry.filename));
          }
          await promisify(sftp.rmdir.bind(sftp))(target);
        } else await promisify(sftp.unlink.bind(sftp))(target);
      };
      await remove(path);
    });
  }

  async open(side: SftpSide, path: string): Promise<void> {
    if (side === 'local') {
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path));
      return;
    }
    const content = await this.remote(async (sftp) => {
      const stat = await promisify(sftp.stat.bind(sftp))(path);
      if (stat.size > 10 * 1024 * 1024) throw new Error('Download files larger than 10 MB to open them locally.');
      const buffer = await promisify(sftp.readFile.bind(sftp))(path);
      if (buffer.includes(0)) throw new Error('Download binary files to open them locally.');
      return buffer.toString('utf8');
    });
    const document = await vscode.workspace.openTextDocument({ content });
    await vscode.window.showTextDocument(document, { preview: true });
  }

  async transfer(side: SftpSide, source: string, destination: string): Promise<void> {
    await this.remote(async (sftp) => {
      const copy = async (local: string, remote: string): Promise<void> => {
        this.signal.throwIfAborted();
        const sourceStat = side === 'local' ? await fs.lstat(local) : await promisify(sftp.lstat.bind(sftp))(remote);
        if (sourceStat.isSymbolicLink()) throw new Error('Symbolic link transfers are not supported.');
        if (!sourceStat.isDirectory() && !sourceStat.isFile())
          throw new Error('Only regular files and directories can be transferred.');
        if (sourceStat.isDirectory()) {
          if (side === 'local') {
            try {
              const stat = await promisify(sftp.lstat.bind(sftp))(remote);
              if (!stat.isDirectory() || stat.isSymbolicLink())
                throw new Error('The remote destination is not a regular directory.');
            } catch (error) {
              if (!isMissing(error)) throw error;
              await promisify(sftp.mkdir.bind(sftp))(remote);
            }
            for (const name of await fs.readdir(local)) await copy(join(local, name), posix.join(remote, name));
          } else {
            try {
              const stat = await fs.lstat(local);
              if (!stat.isDirectory() || stat.isSymbolicLink())
                throw new Error('The local destination is not a regular directory.');
            } catch (error) {
              if (!isMissing(error)) throw error;
              await fs.mkdir(local);
            }
            for (const entry of await promisify(sftp.readdir.bind(sftp))(remote)) {
              if (!['.', '..'].includes(entry.filename)) {
                if (basename(entry.filename) !== entry.filename || entry.filename.includes('\\'))
                  throw new Error('Invalid remote file name.');
                await copy(join(local, entry.filename), posix.join(remote, entry.filename));
              }
            }
          }
        } else {
          try {
            const targetStat =
              side === 'local' ? await promisify(sftp.lstat.bind(sftp))(remote) : await fs.lstat(local);
            if (!targetStat.isFile() || targetStat.isSymbolicLink())
              throw new Error('The destination is not a regular file.');
          } catch (error) {
            if (!isMissing(error)) throw error;
          }
          if (side === 'local') await promisify(sftp.fastPut.bind(sftp))(local, remote);
          else await promisify(sftp.fastGet.bind(sftp))(remote, local);
        }
      };
      if (side === 'local') await copy(source, destination);
      else await copy(destination, source);
    });
  }
}

function isMissing(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && (error.code === 'ENOENT' || error.code === 2),
  );
}
