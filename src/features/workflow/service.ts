import { randomUUID } from 'node:crypto';
import { access, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { WorkflowDefinition, WorkflowFolderRecord, WorkflowRecord, WorkflowRecordEntry } from './protocol';

const entryNameCollator = new Intl.Collator(undefined, { numeric: true });

interface WorkflowStorageIndex {
  entries: WorkflowRecordEntry[];
  workflowPaths: Map<string, string>;
  workflowParents: Map<string, string | undefined>;
  folderPaths: Map<string, string>;
}

export function createWorkflowRecord(parentId?: string): WorkflowRecord {
  return {
    kind: 'workflow',
    id: randomUUID(),
    name: 'New Workflow',
    parentId,
    workflow: { steps: [{ type: 'local-command', command: '' }] },
  };
}

export async function readWorkflowRecords(directory: string): Promise<WorkflowRecordEntry[]> {
  const index = await readWorkflowStorage(directory);
  return index.entries.sort((first, second) => entryNameCollator.compare(first.name, second.name));
}

export async function readWorkflowRecord(directory: string, id: string): Promise<WorkflowRecord | undefined> {
  validateWorkflowId(id);
  const index = await readWorkflowStorage(directory);
  const recordPath = index.workflowPaths.get(id);
  if (!recordPath) return undefined;
  const value: unknown = JSON.parse(await readFile(recordPath, 'utf8'));
  if (!isWorkflowRecord(value) || value.id !== id) throw new Error('Invalid workflow record.');
  return { ...value, kind: 'workflow', parentId: index.workflowParents.get(id) };
}

export async function saveWorkflowRecord(
  directory: string,
  id: string,
  name: string,
  workflow: WorkflowDefinition,
  parentId?: string,
): Promise<WorkflowRecord> {
  validateWorkflowId(id);
  if (!name.trim() || /[\\/\0]/.test(name)) throw new Error('Enter a valid workflow name.');
  if (!isWorkflowDefinition(workflow)) throw new Error('Invalid workflow definition.');
  if (parentId) validateWorkflowFolderId(parentId);
  const index = await readWorkflowStorage(directory);
  const existingPath = index.workflowPaths.get(id);
  const actualParentId = existingPath ? index.workflowParents.get(id) : parentId;
  const targetDirectory = actualParentId ? index.folderPaths.get(actualParentId) : directory;
  if (!targetDirectory) throw new Error('The parent folder no longer exists.');
  const record = {
    kind: 'workflow',
    id,
    name: name.trim(),
    parentId: actualParentId,
    workflow,
  } satisfies WorkflowRecord;
  const target = path.join(targetDirectory, `${id}.json`);
  await writeJsonFile(target, record);
  if (existingPath && existingPath !== target) await rm(existingPath, { force: true });
  return record;
}

export async function deleteWorkflowRecord(directory: string, id: string): Promise<void> {
  validateWorkflowId(id);
  const index = await readWorkflowStorage(directory);
  const recordPath = index.workflowPaths.get(id);
  if (!recordPath) throw new Error('Workflow no longer exists.');
  await rm(recordPath);
}

export async function saveWorkflowFolder(
  directory: string,
  name: string,
  parentId?: string,
): Promise<WorkflowFolderRecord> {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName === '.' || trimmedName === '..' || /[\\/\0]/.test(trimmedName)) {
    throw new Error('Enter a valid folder name.');
  }
  const index = await readWorkflowStorage(directory);
  const parentDirectory = parentId ? index.folderPaths.get(parentId) : directory;
  if (!parentDirectory) throw new Error('The parent folder no longer exists.');
  if (index.entries.some((record) => record.parentId === parentId && record.name === trimmedName)) {
    throw new Error(`"${trimmedName}" already exists in this folder.`);
  }
  const folderPath = path.join(parentDirectory, trimmedName);
  await mkdir(folderPath);
  const id = path.relative(directory, folderPath).split(path.sep).join('/');
  return { kind: 'folder', id, name: trimmedName, parentId };
}

export async function renameWorkflowEntry(directory: string, id: string, rawName: string): Promise<void> {
  const name = rawName.trim();
  if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name)) {
    throw new Error('Enter a valid workflow name.');
  }

  const index = await readWorkflowStorage(directory);
  const entry = index.entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('Workflow entry no longer exists.');
  if (entry.name === name) return;

  if (entry.type === 'workflow') {
    validateWorkflowId(id);
    const recordPath = index.workflowPaths.get(id);
    const value: unknown = recordPath ? JSON.parse(await readFile(recordPath, 'utf8')) : undefined;
    const record = isWorkflowRecord(value) ? value : undefined;
    if (!record) throw new Error('Workflow entry no longer exists.');
    await saveWorkflowRecord(directory, id, name, record.workflow, record.parentId);
    return;
  }

  if (
    index.entries.some(
      (candidate) => candidate.parentId === entry.parentId && candidate.id !== id && candidate.name === name,
    )
  ) {
    throw new Error(`"${name}" already exists in this folder.`);
  }
  const folderPath = index.folderPaths.get(id);
  const parentDirectory = entry.parentId ? index.folderPaths.get(entry.parentId) : directory;
  if (!folderPath || !parentDirectory) throw new Error('Workflow folder no longer exists.');
  const newPath = path.join(parentDirectory, name);
  if (await pathExists(newPath)) throw new Error(`"${name}" already exists in this folder.`);
  await rename(folderPath, newPath);
}

export async function moveWorkflowEntry(directory: string, id: string, parentId?: string): Promise<void> {
  const index = await readWorkflowStorage(directory);
  const entry = index.entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('Workflow entry no longer exists.');
  if (parentId) validateWorkflowFolderId(parentId);
  const targetDirectory = parentId ? index.folderPaths.get(parentId) : directory;
  if (!targetDirectory) throw new Error('The destination folder no longer exists.');

  if (entry.type === 'folder' && parentId && (parentId === id || parentId.startsWith(`${id}/`))) {
    throw new Error('A folder cannot be moved into itself.');
  }
  if (entry.parentId === parentId) return;

  const source = entry.type === 'folder' ? index.folderPaths.get(id) : index.workflowPaths.get(id);
  if (!source) throw new Error('Workflow entry no longer exists.');
  const target = path.join(targetDirectory, entry.type === 'folder' ? entry.name : `${id}.json`);
  if (await pathExists(target)) throw new Error(`"${entry.name}" already exists in that folder.`);
  await rename(source, target);
}

export async function deleteWorkflowEntry(directory: string, id: string): Promise<string[]> {
  const index = await readWorkflowStorage(directory);
  const entry = index.entries.find((record) => record.id === id);
  if (!entry) throw new Error('Workflow entry no longer exists.');
  if (entry.type === 'workflow') {
    validateWorkflowId(id);
    const recordPath = index.workflowPaths.get(id);
    if (recordPath) await rm(recordPath, { force: true });
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
  const folderPath = index.folderPaths.get(id);
  if (!folderPath) throw new Error('Workflow folder no longer exists.');
  await rm(folderPath, { recursive: true, force: true });
  return [...ids];
}

export function validateWorkflowId(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Invalid workflow id.');
  }
}

export function validateWorkflowFolderId(id: string): void {
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
    throw new Error('Invalid workflow folder id.');
  }
}

async function readWorkflowStorage(directory: string): Promise<WorkflowStorageIndex> {
  await mkdir(directory, { recursive: true });
  await migrateLegacyWorkflowStorage(directory);

  const index: WorkflowStorageIndex = {
    entries: [],
    workflowPaths: new Map(),
    workflowParents: new Map(),
    folderPaths: new Map(),
  };

  const visit = async (currentDirectory: string, parentId?: string): Promise<void> => {
    const children = await readdir(currentDirectory, { withFileTypes: true });
    for (const child of children) {
      if (!child.isDirectory()) continue;
      const childPath = path.join(currentDirectory, child.name);
      const id = path.relative(directory, childPath).split(path.sep).join('/');
      index.folderPaths.set(id, childPath);
      index.entries.push({ id, name: child.name, type: 'folder', parentId });
      await visit(childPath, id);
    }

    for (const child of children) {
      if (!child.isFile() || !child.name.endsWith('.json')) continue;
      const recordPath = path.join(currentDirectory, child.name);
      try {
        const value: unknown = JSON.parse(await readFile(recordPath, 'utf8'));
        if (!isWorkflowRecord(value) || child.name !== `${value.id}.json`) continue;
        if (index.workflowPaths.has(value.id)) throw new Error('Duplicate workflow id.');
        index.workflowPaths.set(value.id, recordPath);
        index.workflowParents.set(value.id, parentId);
        index.entries.push({ id: value.id, name: value.name, type: 'workflow', parentId });
      } catch (error) {
        if (error instanceof Error && error.message === 'Duplicate workflow id.') throw error;
      }
    }
  };

  await visit(directory);
  return index;
}

async function migrateLegacyWorkflowStorage(directory: string): Promise<void> {
  const rootFiles = await readdir(directory, { withFileTypes: true });
  const legacyFolders = new Map<string, WorkflowFolderRecord>();
  const legacyWorkflows = new Map<string, WorkflowRecord>();

  for (const file of rootFiles) {
    if (!file.isFile() || !file.name.endsWith('.json')) continue;
    try {
      const value: unknown = JSON.parse(await readFile(path.join(directory, file.name), 'utf8'));
      if (isWorkflowFolderRecord(value) && file.name === `${value.id}.json`) {
        legacyFolders.set(value.id, value);
      } else if (isWorkflowRecord(value) && file.name === `${value.id}.json`) {
        legacyWorkflows.set(value.id, value);
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
    if (resolving.has(id)) throw new Error('Workflow folder hierarchy contains a cycle.');
    resolving.add(id);
    const parentPath = folder.parentId ? await resolveFolderPath(folder.parentId) : directory;
    resolving.delete(id);
    if (!parentPath) return undefined;
    const folderPath = path.join(parentPath, folder.name);
    const existingFolder = [...folderPaths.entries()].find(([, existingPath]) => existingPath === folderPath);
    if (existingFolder && existingFolder[0] !== id)
      throw new Error(`Duplicate legacy workflow folder path: ${folderPath}`);
    folderPaths.set(id, folderPath);
    return folderPath;
  };

  for (const id of legacyFolders.keys()) {
    const folderPath = await resolveFolderPath(id);
    if (folderPath) await mkdir(folderPath, { recursive: true });
  }

  for (const [id, workflow] of legacyWorkflows) {
    if (!workflow.parentId) continue;
    const targetDirectory = await resolveFolderPath(workflow.parentId);
    if (!targetDirectory) continue;
    const source = path.join(directory, `${id}.json`);
    const target = path.join(targetDirectory, `${id}.json`);
    if (source === target) continue;
    await mkdir(targetDirectory, { recursive: true });
    if (await pathExists(target)) {
      const existing = await readFile(target, 'utf8');
      const sourceContents = await readFile(source, 'utf8');
      if (existing !== sourceContents) throw new Error(`Conflicting workflow records for "${id}".`);
      await rm(source);
    } else {
      await rename(source, target);
    }
  }

  for (const id of legacyFolders.keys()) {
    if (folderPaths.has(id)) await rm(path.join(directory, `${id}.json`), { force: true });
  }
  await removeObsoleteWorkflowFolderMarkers(directory);
}

async function removeObsoleteWorkflowFolderMarkers(directory: string): Promise<void> {
  for (const child of await readdir(directory, { withFileTypes: true })) {
    if (!child.isDirectory()) continue;
    const childPath = path.join(directory, child.name);
    await rm(path.join(childPath, '.workflow-folder.json'), { force: true });
    await removeObsoleteWorkflowFolderMarkers(childPath);
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

function isWorkflowRecord(value: unknown): value is WorkflowRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<WorkflowRecord>;
  return (
    (record.kind === undefined || record.kind === 'workflow') &&
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    record.name.trim().length > 0 &&
    (record.parentId === undefined || typeof record.parentId === 'string') &&
    isWorkflowDefinition(record.workflow)
  );
}

function isWorkflowFolderRecord(value: unknown): value is WorkflowFolderRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<WorkflowFolderRecord>;
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

export function isWorkflowDefinition(value: unknown): value is WorkflowDefinition {
  if (!value || typeof value !== 'object') return false;
  const workflow = value as { steps?: unknown };
  return Array.isArray(workflow.steps) && workflow.steps.every(isWorkflowStep);
}

function isWorkflowStep(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const step = value as Record<string, unknown>;
  if (step.type === 'local-command') {
    return typeof step.command === 'string' && (step.cwd === undefined || typeof step.cwd === 'string');
  }
  if (step.type === 'sftp') {
    return (
      typeof step.hostId === 'string' &&
      (step.direction === 'upload' || step.direction === 'download') &&
      typeof step.localPath === 'string' &&
      typeof step.remotePath === 'string'
    );
  }
  return step.type === 'ssh-command' && typeof step.hostId === 'string' && typeof step.command === 'string';
}
