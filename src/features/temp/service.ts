import { createReadStream } from 'node:fs';
import { lstat, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { TempTreeEntry } from './protocol';

const entryNameCollator = new Intl.Collator(undefined, { numeric: true });

export async function readTempTree(directory: string): Promise<TempTreeEntry[]> {
  await mkdir(directory, { recursive: true });
  return readDirectory(directory);
}

export async function searchTempContents(directory: string, query: string): Promise<string[]> {
  const tree = await readTempTree(directory);
  const paths: string[] = [];
  const collectEntries = (entries: readonly TempTreeEntry[], parent: string): void => {
    for (const entry of entries) {
      const relativePath = parent ? `${parent}/${entry.name}` : entry.name;
      if (entry.type === 'directory') collectEntries(entry.children ?? [], relativePath);
      else paths.push(relativePath);
    }
  };
  collectEntries(tree, '');
  const matches = new Array<boolean>(paths.length).fill(false);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(paths.length, 8) }, async () => {
      while (next < paths.length) {
        const index = next++;
        try {
          matches[index] = await searchTempFile(await getTempFilePath(directory, paths[index]), query);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      }
    }),
  );
  return paths.filter((_, index) => matches[index]);
}

async function searchTempFile(filePath: string, query: string): Promise<boolean> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  let tail = '';
  let matched = false;
  for await (const chunk of stream) {
    const text = chunk as string;
    if (text.includes('\0')) return false;
    const combined = tail + text.toLocaleLowerCase();
    matched ||= combined.includes(query);
    tail = query.length > 1 ? combined.slice(-(query.length - 1)) : '';
  }
  return matched;
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

export async function createTempDirectory(directory: string, rawName: string): Promise<string> {
  const name = rawName.trim();
  const validationError = validateTempFolderName(name);
  if (validationError) throw new Error(validationError);

  await mkdir(directory, { recursive: true });
  const directoryPath = path.join(directory, name);
  await mkdir(directoryPath);
  return directoryPath;
}

export async function getTempFilePath(directory: string, relativePath: string): Promise<string> {
  const filePath = resolveTempPath(directory, relativePath);
  const stats = await lstat(filePath);
  if (!stats.isFile()) throw new Error('Only regular temporary files can be opened.');
  return filePath;
}

export async function resolveTempDirectory(directory: string, relativePath: string): Promise<string> {
  const directoryPath = resolveTempPath(directory, relativePath);
  const stats = await lstat(directoryPath);
  if (!stats.isDirectory()) throw new Error('Only temporary folders can hold new items.');
  return directoryPath;
}

/** Removes a temp entry and returns the absolute path of what was deleted. */
export async function deleteTempEntry(directory: string, relativePath: string): Promise<string> {
  const targetPath = resolveTempPath(directory, relativePath);
  const stats = await lstat(targetPath);
  await rm(targetPath, { recursive: stats.isDirectory() });
  return targetPath;
}

/** Renames a temp entry in place and returns its new absolute path. */
export async function renameTempEntry(directory: string, relativePath: string, rawName: string): Promise<string> {
  const name = rawName.trim();
  const targetPath = resolveTempPath(directory, relativePath);
  const stats = await lstat(targetPath);
  const validationError = stats.isDirectory() ? validateTempFolderName(name) : validateTempFileName(name);
  if (validationError) throw new Error(validationError);

  const renamedPath = path.join(path.dirname(targetPath), name);
  if (renamedPath === targetPath) return targetPath;
  if (await pathExists(renamedPath)) throw new Error(`"${name}" already exists.`);

  await rename(targetPath, renamedPath);
  return renamedPath;
}

export function validateTempFileName(name: string): string | undefined {
  return validateTempEntryName(name, 'file');
}

export function validateTempFolderName(name: string): string | undefined {
  return validateTempEntryName(name, 'folder');
}

export function resolveTempFileSystemPath(directory: string, uriPath: string): string {
  if (!uriPath.startsWith('/')) throw new Error('Invalid temporary path.');
  const relativePath = uriPath.slice(1).replace(/\/+$/, '');
  return relativePath ? resolveTempPath(directory, relativePath) : path.resolve(directory);
}

function validateTempEntryName(name: string, kind: 'file' | 'folder'): string | undefined {
  if (!name.trim()) return `Enter a ${kind} name.`;
  if (name === '.' || name === '..' || name.includes('/') || name.includes('\\') || name.includes('\0')) {
    return `Enter a ${kind} name without a path.`;
  }
  return undefined;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function resolveTempPath(directory: string, relativePath: string): string {
  const segments = relativePath.split('/');
  if (
    !relativePath ||
    segments.some(
      (segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0') || segment.includes('\\'),
    )
  ) {
    throw new Error('Invalid temporary path.');
  }

  const rootPath = path.resolve(directory);
  const targetPath = path.resolve(rootPath, ...segments);
  const relativeTargetPath = path.relative(rootPath, targetPath);
  if (
    !relativeTargetPath ||
    relativeTargetPath === '..' ||
    relativeTargetPath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeTargetPath)
  ) {
    throw new Error('Invalid temporary path.');
  }

  return targetPath;
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
