import { lstat, mkdir, readdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { TempTreeEntry } from './protocol';

const entryNameCollator = new Intl.Collator(undefined, { numeric: true });

export async function readTempTree(directory: string): Promise<TempTreeEntry[]> {
  await mkdir(directory, { recursive: true });
  return readDirectory(directory);
}

export async function createTempFile(directory: string, rawName: string): Promise<string> {
  const name = rawName.trim();
  const validationError = validateTempFileName(name);
  if (validationError) throw new Error(validationError);

  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, name);
  await writeFile(filePath, '', { encoding: 'utf8', flag: 'wx' });
  return filePath;
}

export async function getTempFilePath(directory: string, relativePath: string): Promise<string> {
  const segments = relativePath.split('/');
  if (
    !relativePath ||
    segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0'))
  ) {
    throw new Error('Invalid temporary file path.');
  }

  const rootPath = path.resolve(directory);
  const filePath = path.resolve(rootPath, ...segments);
  const relativeFilePath = path.relative(rootPath, filePath);
  if (
    !relativeFilePath ||
    relativeFilePath === '..' ||
    relativeFilePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeFilePath)
  ) {
    throw new Error('Invalid temporary file path.');
  }

  const stats = await lstat(filePath);
  if (!stats.isFile()) throw new Error('Only regular temporary files can be opened.');
  return filePath;
}

export function validateTempFileName(name: string): string | undefined {
  if (!name.trim()) return 'Enter a file name.';
  if (name === '.' || name === '..' || name.includes('/') || name.includes('\\') || name.includes('\0')) {
    return 'Enter a file name without a path.';
  }
  return undefined;
}

async function readDirectory(directory: string): Promise<TempTreeEntry[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const tree: TempTreeEntry[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      tree.push({
        name: entry.name,
        type: 'directory',
        children: await readDirectory(path.join(directory, entry.name)),
      });
    } else if (entry.isFile()) {
      tree.push({ name: entry.name, type: 'file' });
    }
  }
  return tree.sort((left, right) =>
    left.type === right.type ? entryNameCollator.compare(left.name, right.name) : left.type === 'directory' ? -1 : 1,
  );
}
