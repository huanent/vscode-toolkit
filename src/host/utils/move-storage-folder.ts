import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readdir, readlink, realpath, rmdir, symlink, unlink } from 'node:fs/promises';
import * as path from 'node:path';

export async function moveStorageFolder(
  source: string,
  destinationRoot: string,
  relativePath: string,
  beforeMove?: () => Promise<void>,
): Promise<void> {
  const segments = relativePath.split('/');
  const destination = path.join(destinationRoot, ...segments);
  const actualSource = await realpath(source);
  const actualDestination = path.join(await resolveFolderPath(destinationRoot), ...segments);
  if (
    actualDestination === actualSource ||
    actualDestination.startsWith(`${actualSource}${path.sep}`) ||
    actualSource.startsWith(`${actualDestination}${path.sep}`)
  ) {
    throw new Error('The source and destination folders overlap.');
  }
  let targetParent = destinationRoot;
  for (const segment of segments.slice(0, -1)) {
    targetParent = path.join(targetParent, segment);
    const stats = await statIfPresent(targetParent);
    if (stats && !stats.isDirectory()) throw new Error(`Cannot merge folder: "${targetParent}" already exists.`);
  }

  const operations: Array<() => Promise<unknown>> = [];
  const plan = async (from: string, to: string): Promise<void> => {
    const sourceStats = await lstat(from);
    const targetStats = await statIfPresent(to);
    if (sourceStats.isDirectory()) {
      if (targetStats) {
        if (!targetStats.isDirectory()) throw new Error(`Cannot merge folder: "${to}" already exists.`);
        if (sourceStats.dev === targetStats.dev && sourceStats.ino === targetStats.ino) {
          throw new Error('The source and destination folders overlap.');
        }
      }
      operations.push(() => mkdir(to, { recursive: true }));
      for (const child of await readdir(from)) await plan(path.join(from, child), path.join(to, child));
      operations.push(() => rmdir(from));
      return;
    }

    if (targetStats) throw new Error(`Cannot merge folder: "${to}" already exists.`);
    if (sourceStats.isFile()) {
      operations.push(() => copyFile(from, to, constants.COPYFILE_EXCL));
    } else if (sourceStats.isSymbolicLink()) {
      const link = await readlink(from);
      operations.push(() => symlink(link, to));
    } else {
      throw new Error(`Cannot move unsupported file type: "${from}".`);
    }
    operations.push(() => unlink(from));
  };

  await plan(source, destination);
  await beforeMove?.();
  for (const operation of operations) await operation();
}

async function resolveFolderPath(folder: string): Promise<string> {
  try {
    return await realpath(folder);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const parent = path.dirname(folder);
    if (parent === folder) throw error;
    return path.join(await resolveFolderPath(parent), path.basename(folder));
  }
}

async function statIfPresent(target: string) {
  try {
    return await lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
