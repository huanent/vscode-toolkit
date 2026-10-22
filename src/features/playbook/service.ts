import { randomUUID } from 'node:crypto';
import { access, lstat, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { PlaybookDefinition, PlaybookFolderRecord, PlaybookRecord, PlaybookRecordEntry } from './protocol';
import { findStorageRoot, type StorageRoot, type StorageScope } from '@/shared/storage-scope';

const entryNameCollator = new Intl.Collator(undefined, { numeric: true });

export type StoredPlaybookRecord = PlaybookRecord & { scope: StorageScope };

interface StoredPlaybookLocation {
  path: string;
  root: StorageRoot;
  parentId?: string;
}

interface PlaybookStorageIndex {
  entries: PlaybookRecordEntry[];
  playbooks: Map<string, StoredPlaybookLocation>;
  folders: Map<string, StorageRoot[]>;
}

export function createPlaybookRecord(parentId?: string): PlaybookRecord {
  return {
    kind: 'playbook',
    id: randomUUID(),
    name: 'New Playbook',
    enableAI: true,
    parentId,
    playbook: { steps: [] },
  };
}

export async function readPlaybookRecords(roots: readonly StorageRoot[]): Promise<PlaybookRecordEntry[]> {
  const index = await readPlaybookStorage(roots);
  return index.entries.sort((first, second) => entryNameCollator.compare(first.name, second.name));
}

export async function readPlaybookRecord(
  roots: readonly StorageRoot[],
  id: string,
): Promise<StoredPlaybookRecord | undefined> {
  if (!/^[0-9a-f-]+$/i.test(id)) throw new Error('Invalid playbook id.');
  const index = await readPlaybookStorage(roots);
  let resolvedId = id;
  if (!index.playbooks.has(id)) {
    const matches = [...index.playbooks.keys()].filter((playbookId) => playbookId.startsWith(id));
    if (matches.length > 1) {
      throw new Error(`Playbook ID prefix "${id}" matches multiple playbooks. Use a longer ID.`);
    }
    if (!matches.length) return undefined;
    resolvedId = matches[0];
  }
  const location = index.playbooks.get(resolvedId);
  if (!location) return undefined;
  const value = addLegacyPlaybookStepNames(JSON.parse(await readFile(location.path, 'utf8')));
  if (!isPlaybookRecord(value) || value.id !== resolvedId) throw new Error('Invalid playbook record.');
  return { ...value, kind: 'playbook', parentId: location.parentId, scope: location.root.scope };
}

export async function savePlaybookRecord(
  roots: readonly StorageRoot[],
  id: string,
  name: string,
  playbook: PlaybookDefinition,
  parentId: string | undefined,
  scope: StorageScope,
  description?: string,
  enableAI?: boolean,
): Promise<StoredPlaybookRecord> {
  validatePlaybookId(id);
  if (!name.trim() || /[\\/\0]/.test(name)) throw new Error('Enter a valid playbook name.');
  if (!isPlaybookDefinition(playbook)) throw new Error('Invalid playbook definition.');
  if (parentId) validatePlaybookFolderId(parentId);
  const index = await readPlaybookStorage(roots);
  const existing = index.playbooks.get(id);
  const actualParentId = existing ? existing.parentId : parentId;
  if (actualParentId && !index.folders.has(actualParentId)) throw new Error('The parent folder no longer exists.');
  const root = findStorageRoot(roots, scope);
  const targetDirectory = actualParentId ? playbookFolderPath(root, actualParentId) : root.directory;
  const record: PlaybookRecord = {
    kind: 'playbook',
    id,
    name: name.trim(),
    description,
    enableAI: enableAI !== false,
    parentId: actualParentId,
    playbook,
  };
  const target = path.join(targetDirectory, `${id}.json`);
  await writeJsonFile(target, record);
  if (existing && existing.path !== target) await rm(existing.path, { force: true });
  return { ...record, scope: root.scope };
}

export async function savePlaybookFolder(
  roots: readonly StorageRoot[],
  name: string,
  parentId?: string,
): Promise<PlaybookFolderRecord> {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName === '.' || trimmedName === '..' || /[\\/\0]/.test(trimmedName)) {
    throw new Error('Enter a valid folder name.');
  }
  const index = await readPlaybookStorage(roots);
  const root = parentId ? index.folders.get(parentId)?.[0] : findStorageRoot(roots, 'global');
  if (!root) throw new Error('The parent folder no longer exists.');
  if (index.entries.some((record) => record.parentId === parentId && record.name === trimmedName)) {
    throw new Error(`"${trimmedName}" already exists in this folder.`);
  }
  await mkdir(root.directory, { recursive: true });
  const id = parentId ? `${parentId}/${trimmedName}` : trimmedName;
  await mkdir(playbookFolderPath(root, id));
  return { kind: 'folder', id, name: trimmedName, parentId };
}

export async function renamePlaybookEntry(roots: readonly StorageRoot[], id: string, rawName: string): Promise<void> {
  const name = rawName.trim();
  if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name)) {
    throw new Error('Enter a valid playbook name.');
  }

  const index = await readPlaybookStorage(roots);
  const entry = index.entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('Playbook entry no longer exists.');
  if (entry.name === name) return;

  if (entry.type === 'playbook') {
    const record = await readPlaybookRecord(roots, id);
    if (!record) throw new Error('Playbook entry no longer exists.');
    await savePlaybookRecord(
      roots,
      id,
      name,
      record.playbook,
      record.parentId,
      record.scope,
      record.description,
      record.enableAI,
    );
    return;
  }

  if (
    index.entries.some(
      (candidate) => candidate.parentId === entry.parentId && candidate.id !== id && candidate.name === name,
    )
  ) {
    throw new Error(`"${name}" already exists in this folder.`);
  }
  const folderRoots = index.folders.get(id);
  if (!folderRoots) throw new Error('Playbook folder no longer exists.');
  const moves = folderRoots.map((root) => {
    const source = playbookFolderPath(root, id);
    return { source, target: path.join(path.dirname(source), name) };
  });
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

export async function movePlaybookEntry(roots: readonly StorageRoot[], id: string, parentId?: string): Promise<void> {
  const index = await readPlaybookStorage(roots);
  const entry = index.entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('Playbook entry no longer exists.');
  if (parentId) validatePlaybookFolderId(parentId);
  if (parentId && !index.folders.has(parentId)) throw new Error('The destination folder no longer exists.');

  if (entry.type === 'folder' && parentId && (parentId === id || parentId.startsWith(`${id}/`))) {
    throw new Error('A folder cannot be moved into itself.');
  }
  if (entry.parentId === parentId) return;

  if (entry.type === 'folder') {
    const moves = (index.folders.get(id) ?? []).map((root) => {
      const destination = parentId ? playbookFolderPath(root, parentId) : root.directory;
      return { source: playbookFolderPath(root, id), destination, target: path.join(destination, entry.name) };
    });
    for (const move of moves) {
      if (await pathExists(move.target)) throw new Error(`"${entry.name}" already exists in that folder.`);
    }
    for (const move of moves) {
      await mkdir(move.destination, { recursive: true });
      await rename(move.source, move.target);
    }
    return;
  }

  const location = index.playbooks.get(id);
  if (!location) throw new Error('Playbook entry no longer exists.');
  const destination = parentId ? playbookFolderPath(location.root, parentId) : location.root.directory;
  const target = path.join(destination, `${id}.json`);
  if (await pathExists(target)) throw new Error(`"${entry.name}" already exists in that folder.`);
  await mkdir(destination, { recursive: true });
  await rename(location.path, target);
}

export async function deletePlaybookEntry(roots: readonly StorageRoot[], id: string): Promise<string[]> {
  const index = await readPlaybookStorage(roots);
  const entry = index.entries.find((record) => record.id === id);
  if (!entry) throw new Error('Playbook entry no longer exists.');
  if (entry.type === 'playbook') {
    const location = index.playbooks.get(id);
    if (location) await rm(location.path, { force: true });
    return [id];
  }

  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of index.entries) {
      if (record.parentId && ids.has(record.parentId) && !ids.has(record.id)) {
        ids.add(record.id);
        changed = true;
      }
    }
  }
  const folderRoots = index.folders.get(id);
  if (!folderRoots) throw new Error('Playbook folder no longer exists.');
  for (const root of folderRoots) await rm(playbookFolderPath(root, id), { recursive: true, force: true });
  return [...ids];
}

export function validatePlaybookId(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Invalid playbook id.');
  }
}

export function validatePlaybookFolderId(id: string): void {
  if (
    !id ||
    id.startsWith('/') ||
    id
      .split('/')
      .some(
        (segment) =>
          !segment || segment === '.' || segment === '..' || segment.includes('\\') || segment.includes('\0'),
      )
  ) {
    throw new Error('Invalid playbook folder id.');
  }
}

async function readPlaybookStorage(roots: readonly StorageRoot[]): Promise<PlaybookStorageIndex> {
  const index: PlaybookStorageIndex = { entries: [], playbooks: new Map(), folders: new Map() };
  const folderEntries = new Map<string, PlaybookRecordEntry>();

  const visit = async (root: StorageRoot, currentDirectory: string, parentId?: string): Promise<void> => {
    const children = await readdir(currentDirectory, { withFileTypes: true });
    for (const child of children) {
      if (!child.isDirectory()) continue;
      const id = parentId ? `${parentId}/${child.name}` : child.name;
      index.folders.set(id, [...(index.folders.get(id) ?? []), root]);
      if (!folderEntries.has(id)) folderEntries.set(id, { id, name: child.name, type: 'folder', parentId });
      await visit(root, path.join(currentDirectory, child.name), id);
    }

    for (const child of children) {
      if (!child.isFile() || !child.name.endsWith('.json')) continue;
      const recordPath = path.join(currentDirectory, child.name);
      try {
        const value = addLegacyPlaybookStepNames(JSON.parse(await readFile(recordPath, 'utf8')));
        if (!isPlaybookRecord(value) || child.name !== `${value.id}.json`) continue;
        if (index.playbooks.has(value.id)) throw new Error('Duplicate playbook id.');
        index.playbooks.set(value.id, { path: recordPath, root, parentId });
        index.entries.push({ id: value.id, name: value.name, type: 'playbook', parentId });
      } catch (error) {
        if (error instanceof Error && error.message === 'Duplicate playbook id.') throw error;
      }
    }
  };

  for (const root of roots) {
    if (!(await pathExists(root.directory))) continue;
    await migrateLegacyPlaybookStorage(root.directory);
    await visit(root, root.directory);
  }
  index.entries.push(...folderEntries.values());
  return index;
}

function playbookFolderPath(root: StorageRoot, folderId: string): string {
  return path.join(root.directory, ...folderId.split('/'));
}

async function migrateLegacyPlaybookStorage(directory: string): Promise<void> {
  const rootFiles = await readdir(directory, { withFileTypes: true });
  const legacyFolders = new Map<string, PlaybookFolderRecord>();
  const legacyPlaybooks = new Map<string, PlaybookRecord>();

  for (const file of rootFiles) {
    if (!file.isFile() || !file.name.endsWith('.json')) continue;
    try {
      const value = addLegacyPlaybookStepNames(JSON.parse(await readFile(path.join(directory, file.name), 'utf8')));
      if (isPlaybookFolderRecord(value) && file.name === `${value.id}.json`) {
        legacyFolders.set(value.id, value);
      } else if (isPlaybookRecord(value) && file.name === `${value.id}.json`) {
        legacyPlaybooks.set(value.id, value);
      }
    } catch {
      // Ignore records that are invalid or no longer supported.
    }
  }

  const folderPaths = new Map<string, string>();
  const resolving = new Set<string>();
  const resolveFolderPath = async (id: string): Promise<string | undefined> => {
    const cached = folderPaths.get(id);
    if (cached) return cached;
    const folder = legacyFolders.get(id);
    if (!folder) return undefined;
    if (resolving.has(id)) throw new Error('Playbook folder hierarchy contains a cycle.');
    resolving.add(id);
    const parentPath = folder.parentId ? await resolveFolderPath(folder.parentId) : directory;
    resolving.delete(id);
    if (!parentPath) return undefined;
    const folderPath = path.join(parentPath, folder.name);
    const existingFolder = [...folderPaths.entries()].find(([, existingPath]) => existingPath === folderPath);
    if (existingFolder && existingFolder[0] !== id)
      throw new Error(`Duplicate legacy playbook folder path: ${folderPath}`);
    folderPaths.set(id, folderPath);
    return folderPath;
  };

  for (const id of legacyFolders.keys()) {
    const folderPath = await resolveFolderPath(id);
    if (folderPath) await mkdir(folderPath, { recursive: true });
  }

  for (const [id, playbook] of legacyPlaybooks) {
    if (!playbook.parentId) continue;
    const targetDirectory = await resolveFolderPath(playbook.parentId);
    if (!targetDirectory) continue;
    const source = path.join(directory, `${id}.json`);
    const target = path.join(targetDirectory, `${id}.json`);
    if (source === target) continue;
    await mkdir(targetDirectory, { recursive: true });
    if (await pathExists(target)) {
      const existing = await readFile(target, 'utf8');
      const sourceContents = await readFile(source, 'utf8');
      if (existing !== sourceContents) throw new Error(`Conflicting playbook records for "${id}".`);
      await rm(source);
    } else {
      await rename(source, target);
    }
  }

  for (const id of legacyFolders.keys()) {
    if (folderPaths.has(id)) await rm(path.join(directory, `${id}.json`), { force: true });
  }
  await removeObsoletePlaybookFolderMarkers(directory);
}

async function removeObsoletePlaybookFolderMarkers(directory: string): Promise<void> {
  for (const child of await readdir(directory, { withFileTypes: true })) {
    if (!child.isDirectory()) continue;
    const childPath = path.join(directory, child.name);
    await rm(path.join(childPath, '.playbook-folder.json'), { force: true });
    await removeObsoletePlaybookFolderMarkers(childPath);
  }
}

async function writeJsonFile(target: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function isPlaybookRecord(value: unknown): value is PlaybookRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<PlaybookRecord>;
  return (
    (record.kind === undefined || record.kind === 'playbook') &&
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    record.name.trim().length > 0 &&
    (record.description === undefined || typeof record.description === 'string') &&
    (record.enableAI === undefined || typeof record.enableAI === 'boolean') &&
    (record.parentId === undefined || typeof record.parentId === 'string') &&
    isPlaybookDefinition(record.playbook)
  );
}

function isPlaybookFolderRecord(value: unknown): value is PlaybookFolderRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<PlaybookFolderRecord>;
  return (
    record.kind === 'folder' &&
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    record.name.trim().length > 0 &&
    record.name !== '.' &&
    record.name !== '..' &&
    !/[\\/\0]/.test(record.name) &&
    (record.parentId === undefined || typeof record.parentId === 'string')
  );
}

export function isPlaybookDefinition(value: unknown): value is PlaybookDefinition {
  if (!value || typeof value !== 'object') return false;
  const playbook = value as { steps?: unknown; environment?: unknown };
  return (
    Array.isArray(playbook.steps) &&
    playbook.steps.every(isPlaybookStep) &&
    (playbook.environment === undefined ||
      (Array.isArray(playbook.environment) &&
        playbook.environment.every(isPlaybookEnvironmentVariable) &&
        new Set(playbook.environment.map((variable) => variable.name.toUpperCase())).size ===
          playbook.environment.length))
  );
}

function isPlaybookEnvironmentVariable(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const variable = value as Record<string, unknown>;
  return (
    typeof variable.name === 'string' &&
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.name) &&
    typeof variable.label === 'string' &&
    ((variable.type === 'input' &&
      typeof variable.defaultValue === 'string' &&
      !variable.defaultValue.includes('\0')) ||
      (variable.type === 'checkbox' && typeof variable.defaultValue === 'boolean') ||
      (variable.type === 'select' &&
        typeof variable.defaultValue === 'string' &&
        Array.isArray(variable.options) &&
        variable.options.length > 0 &&
        variable.options.every(
          (option) =>
            option &&
            typeof option === 'object' &&
            typeof option.value === 'string' &&
            option.value.trim().length > 0 &&
            !option.value.includes('\0') &&
            typeof option.label === 'string' &&
            option.label.trim().length > 0,
        ) &&
        new Set(variable.options.map((option) => option.value)).size === variable.options.length &&
        variable.options.some((option) => option.value === variable.defaultValue)))
  );
}

function isPlaybookStep(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const step = value as Record<string, unknown>;
  if (typeof step.name !== 'string' || !step.name.trim()) return false;
  if (step.type === 'local-command') {
    return typeof step.command === 'string' && (step.cwd === undefined || typeof step.cwd === 'string');
  }
  if (step.type === 'sftp') {
    return (
      typeof step.assetId === 'string' &&
      (step.direction === 'upload' || step.direction === 'download') &&
      typeof step.localPath === 'string' &&
      typeof step.remotePath === 'string'
    );
  }
  return step.type === 'ssh-command' && typeof step.assetId === 'string' && typeof step.command === 'string';
}

function addLegacyPlaybookStepNames(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as { playbook?: unknown };
  if (!record.playbook || typeof record.playbook !== 'object') return value;
  const playbook = record.playbook as { steps?: unknown };
  if (!Array.isArray(playbook.steps)) return value;
  return {
    ...record,
    playbook: {
      ...playbook,
      steps: playbook.steps.map((step, index) =>
        step && typeof step === 'object' && !('name' in step) ? { ...step, name: `Step ${index + 1}` } : step,
      ),
    },
  };
}
