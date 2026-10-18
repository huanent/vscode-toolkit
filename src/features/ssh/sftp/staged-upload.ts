import { randomUUID } from 'node:crypto';
import { posix } from 'node:path';
import { promisify } from 'node:util';
import type { SFTPWrapper } from 'ssh2';

export async function stagedUpload(
  sftp: SFTPWrapper,
  destination: string,
  upload: (temporaryPath: string) => Promise<void>,
  options: { create: boolean; overwrite: boolean } = { create: true, overwrite: true },
): Promise<void> {
  const target = await promisify(sftp.lstat.bind(sftp))(destination).catch((error: unknown) => {
    if (error && typeof error === 'object' && 'code' in error && (error.code === 2 || error.code === 'ENOENT'))
      return undefined;
    throw error;
  });
  if (!target && !options.create) throw new Error('The remote file no longer exists.');
  if (target && !options.overwrite) throw new Error('The remote file already exists.');
  if (target && (!target.isFile() || target.isSymbolicLink()))
    throw new Error('The destination is not a regular file.');

  const temporaryDirectory = posix.join(posix.dirname(destination), `.toolkit-tmp-${randomUUID()}`);
  const temporaryPath = posix.join(temporaryDirectory, 'upload');
  await new Promise<void>((resolve, reject) => {
    sftp.mkdir(temporaryDirectory, { mode: 0o700 }, (error) => (error ? reject(error) : resolve()));
  });
  try {
    await upload(temporaryPath);
    if (target) {
      const uploaded = await promisify(sftp.stat.bind(sftp))(temporaryPath);
      if (uploaded.uid !== target.uid || uploaded.gid !== target.gid)
        await promisify(sftp.chown.bind(sftp))(temporaryPath, target.uid, target.gid);
      await promisify(sftp.chmod.bind(sftp))(temporaryPath, target.mode & 0o7777);
      const preserved = await promisify(sftp.stat.bind(sftp))(temporaryPath);
      if (
        preserved.uid !== target.uid ||
        preserved.gid !== target.gid ||
        (preserved.mode & 0o7777) !== (target.mode & 0o7777)
      )
        throw new Error('Cannot preserve the remote file permissions and ownership. The original was not replaced.');
    }
    const current = await promisify(sftp.lstat.bind(sftp))(destination).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && (error.code === 2 || error.code === 'ENOENT'))
        return undefined;
      throw error;
    });
    if (
      Boolean(current) !== Boolean(target) ||
      (current &&
        target &&
        (!current.isFile() ||
          current.isSymbolicLink() ||
          current.uid !== target.uid ||
          current.gid !== target.gid ||
          current.mode !== target.mode ||
          current.size !== target.size ||
          current.mtime !== target.mtime))
    )
      throw new Error('The remote destination changed during upload. The original was not replaced.');
    if (target) {
      await promisify(sftp.ext_openssh_rename.bind(sftp))(temporaryPath, destination).catch(async (error: unknown) => {
        if (!(error instanceof Error) || !/unsupported|not supported/i.test(error.message)) throw error;
        await promisify(sftp.rename.bind(sftp))(temporaryPath, destination);
      });
    } else await promisify(sftp.rename.bind(sftp))(temporaryPath, destination);
  } finally {
    await promisify(sftp.unlink.bind(sftp))(temporaryPath).catch(() => {});
    await promisify(sftp.rmdir.bind(sftp))(temporaryDirectory).catch(() => {});
  }
}
