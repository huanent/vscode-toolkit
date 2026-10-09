import { lstat, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { WorkflowTreeEntry } from './protocol';

const entryNameCollator = new Intl.Collator(undefined, { numeric: true });

export async function readWorkflowTree(directory: string): Promise<WorkflowTreeEntry[]> {
  await mkdir(directory, { recursive: true });
  return readDirectory(directory);
}

export async function createWorkflowFile(directory: string, rawName: string): Promise<string> {
  const name = rawName.trim();
  const validationError = validateWorkflowFileName(name);
  if (validationError) throw new Error(validationError);

  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, name);
  await writeFile(filePath, '', { encoding: 'utf8', flag: 'wx' });
  return filePath;
}

export async function createWorkflowDirectory(directory: string, rawName: string): Promise<string> {
  const name = rawName.trim();
  const validationError = validateWorkflowFolderName(name);
  if (validationError) throw new Error(validationError);

  await mkdir(directory, { recursive: true });
  const directoryPath = path.join(directory, name);
  await mkdir(directoryPath);
  return directoryPath;
}

export async function getWorkflowFilePath(directory: string, relativePath: string): Promise<string> {
  const filePath = resolveWorkflowPath(directory, relativePath);
  const stats = await lstat(filePath);
  if (!stats.isFile()) throw new Error('Only regular workflow files can be opened.');
  return filePath;
}

export async function resolveWorkflowDirectory(directory: string, relativePath: string): Promise<string> {
  const directoryPath = resolveWorkflowPath(directory, relativePath);
  const stats = await lstat(directoryPath);
  if (!stats.isDirectory()) throw new Error('Only workflow folders can hold new items.');
  return directoryPath;
}

/** Removes a workflow entry and returns the absolute path of what was deleted. */
export async function deleteWorkflowEntry(directory: string, relativePath: string): Promise<string> {
  const targetPath = resolveWorkflowPath(directory, relativePath);
  const stats = await lstat(targetPath);
  await rm(targetPath, { recursive: stats.isDirectory() });
  return targetPath;
}

/** Renames a workflow entry in place and returns its new absolute path. */
export async function renameWorkflowEntry(directory: string, relativePath: string, rawName: string): Promise<string> {
  const name = rawName.trim();
  const targetPath = resolveWorkflowPath(directory, relativePath);
  const stats = await lstat(targetPath);
  const validationError = stats.isDirectory() ? validateWorkflowFolderName(name) : validateWorkflowFileName(name);
  if (validationError) throw new Error(validationError);

  const renamedPath = path.join(path.dirname(targetPath), name);
  if (renamedPath === targetPath) return targetPath;
  if (await pathExists(renamedPath)) throw new Error(`"${name}" already exists.`);

  await rename(targetPath, renamedPath);
  return renamedPath;
}

export function validateWorkflowFileName(name: string): string | undefined {
  return validateWorkflowEntryName(name, 'file');
}

export function validateWorkflowFolderName(name: string): string | undefined {
  return validateWorkflowEntryName(name, 'folder');
}

export function resolveWorkflowFileSystemPath(directory: string, uriPath: string): string {
  if (!uriPath.startsWith('/')) throw new Error('Invalid workflow path.');
  const relativePath = uriPath.slice(1).replace(/\/+$/, '');
  return relativePath ? resolveWorkflowPath(directory, relativePath) : path.resolve(directory);
}

function validateWorkflowEntryName(name: string, kind: 'file' | 'folder'): string | undefined {
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

function resolveWorkflowPath(directory: string, relativePath: string): string {
  const segments = relativePath.split('/');
  if (
    !relativePath ||
    segments.some(
      (segment) => !segment || segment === '.' || segment === '..' || segment.includes('\0') || segment.includes('\\'),
    )
  ) {
    throw new Error('Invalid workflow path.');
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
    throw new Error('Invalid workflow path.');
  }

  return targetPath;
}

async function readDirectory(directory: string): Promise<WorkflowTreeEntry[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const tree: WorkflowTreeEntry[] = [];
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
