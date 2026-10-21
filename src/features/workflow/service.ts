import { randomUUID } from 'node:crypto';
import { access, lstat, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { WorkflowDefinition, WorkflowFolderRecord, WorkflowRecord, WorkflowRecordEntry } from './protocol';
import { findStorageRoot, type StorageRoot, type StorageScope } from '@/shared/storage-scope';

const entryNameCollator = new Intl.Collator(undefined, { numeric: true });

export type StoredWorkflowRecord = WorkflowRecord & { scope: StorageScope };

interface StoredWorkflowLocation {
  path: string;
  root: StorageRoot;
  parentId?: string;
}

interface WorkflowStorageIndex {
  entries: WorkflowRecordEntry[];
  workflows: Map<string, StoredWorkflowLocation>;
  folders: Map<string, StorageRoot[]>;
}

export function createWorkflowRecord(parentId?: string): WorkflowRecord {
  return {
    kind: 'workflow',
    id: randomUUID(),
    name: 'New Workflow',
    enableAI: true,
    parentId,
    workflow: { steps: [] },
  };
}

export async function readWorkflowRecords(roots: readonly StorageRoot[]): Promise<WorkflowRecordEntry[]> {
  const index = await readWorkflowStorage(roots);
  return index.entries.sort((first, second) => entryNameCollator.compare(first.name, second.name));
}

export async function readWorkflowRecord(
  roots: readonly StorageRoot[],
  id: string,
): Promise<StoredWorkflowRecord | undefined> {
  if (!/^[0-9a-f-]+$/i.test(id)) throw new Error('Invalid workflow id.');
  const index = await readWorkflowStorage(roots);
  let resolvedId = id;
  if (!index.workflows.has(id)) {
    const matches = [...index.workflows.keys()].filter((workflowId) => workflowId.startsWith(id));
    if (matches.length > 1) {
      throw new Error(`Workflow ID prefix "${id}" matches multiple workflows. Use a longer ID.`);
    }
    if (!matches.length) return undefined;
    resolvedId = matches[0];
  }
  const location = index.workflows.get(resolvedId);
  if (!location) return undefined;
  const value = addLegacyWorkflowStepNames(JSON.parse(await readFile(location.path, 'utf8')));
  if (!isWorkflowRecord(value) || value.id !== resolvedId) throw new Error('Invalid workflow record.');
  return { ...value, kind: 'workflow', parentId: location.parentId, scope: location.root.scope };
}

export async function saveWorkflowRecord(
  roots: readonly StorageRoot[],
  id: string,
  name: string,
  workflow: WorkflowDefinition,
  parentId: string | undefined,
  scope: StorageScope,
  description?: string,
  enableAI?: boolean,
): Promise<StoredWorkflowRecord> {
  validateWorkflowId(id);
  if (!name.trim() || /[\\/\0]/.test(name)) throw new Error('Enter a valid workflow name.');
  if (!isWorkflowDefinition(workflow)) throw new Error('Invalid workflow definition.');
  if (parentId) validateWorkflowFolderId(parentId);
  const index = await readWorkflowStorage(roots);
  const existing = index.workflows.get(id);
  const actualParentId = existing ? existing.parentId : parentId;
  if (actualParentId && !index.folders.has(actualParentId)) throw new Error('The parent folder no longer exists.');
  const root = findStorageRoot(roots, scope);
  const targetDirectory = actualParentId ? workflowFolderPath(root, actualParentId) : root.directory;
  const record: WorkflowRecord = {
    kind: 'workflow',
    id,
    name: name.trim(),
    description,
    enableAI: enableAI !== false,
    parentId: actualParentId,
    workflow,
  };
  const target = path.join(targetDirectory, `${id}.json`);
  await writeJsonFile(target, record);
  if (existing && existing.path !== target) await rm(existing.path, { force: true });
  return { ...record, scope: root.scope };
}

export async function saveWorkflowFolder(
  roots: readonly StorageRoot[],
  name: string,
  parentId?: string,
): Promise<WorkflowFolderRecord> {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName === '.' || trimmedName === '..' || /[\\/\0]/.test(trimmedName)) {
    throw new Error('Enter a valid folder name.');
  }
  const index = await readWorkflowStorage(roots);
  const root = parentId ? index.folders.get(parentId)?.[0] : findStorageRoot(roots, 'global');
  if (!root) throw new Error('The parent folder no longer exists.');
  if (index.entries.some((record) => record.parentId === parentId && record.name === trimmedName)) {
    throw new Error(`"${trimmedName}" already exists in this folder.`);
  }
  await mkdir(root.directory, { recursive: true });
  const id = parentId ? `${parentId}/${trimmedName}` : trimmedName;
  await mkdir(workflowFolderPath(root, id));
  return { kind: 'folder', id, name: trimmedName, parentId };
}

export async function renameWorkflowEntry(roots: readonly StorageRoot[], id: string, rawName: string): Promise<void> {
  const name = rawName.trim();
  if (!name || name === '.' || name === '..' || /[\\/\0]/.test(name)) {
    throw new Error('Enter a valid workflow name.');
  }

  const index = await readWorkflowStorage(roots);
  const entry = index.entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('Workflow entry no longer exists.');
  if (entry.name === name) return;

  if (entry.type === 'workflow') {
    const record = await readWorkflowRecord(roots, id);
    if (!record) throw new Error('Workflow entry no longer exists.');
    await saveWorkflowRecord(
      roots,
      id,
      name,
      record.workflow,
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
  if (!folderRoots) throw new Error('Workflow folder no longer exists.');
  const moves = folderRoots.map((root) => {
    const source = workflowFolderPath(root, id);
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

export async function moveWorkflowEntry(roots: readonly StorageRoot[], id: string, parentId?: string): Promise<void> {
  const index = await readWorkflowStorage(roots);
  const entry = index.entries.find((candidate) => candidate.id === id);
  if (!entry) throw new Error('Workflow entry no longer exists.');
  if (parentId) validateWorkflowFolderId(parentId);
  if (parentId && !index.folders.has(parentId)) throw new Error('The destination folder no longer exists.');

  if (entry.type === 'folder' && parentId && (parentId === id || parentId.startsWith(`${id}/`))) {
    throw new Error('A folder cannot be moved into itself.');
  }
  if (entry.parentId === parentId) return;

  if (entry.type === 'folder') {
    const moves = (index.folders.get(id) ?? []).map((root) => {
      const destination = parentId ? workflowFolderPath(root, parentId) : root.directory;
      return { source: workflowFolderPath(root, id), destination, target: path.join(destination, entry.name) };
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

  const location = index.workflows.get(id);
  if (!location) throw new Error('Workflow entry no longer exists.');
  const destination = parentId ? workflowFolderPath(location.root, parentId) : location.root.directory;
  const target = path.join(destination, `${id}.json`);
  if (await pathExists(target)) throw new Error(`"${entry.name}" already exists in that folder.`);
  await mkdir(destination, { recursive: true });
  await rename(location.path, target);
}

export async function deleteWorkflowEntry(roots: readonly StorageRoot[], id: string): Promise<string[]> {
  const index = await readWorkflowStorage(roots);
  const entry = index.entries.find((record) => record.id === id);
  if (!entry) throw new Error('Workflow entry no longer exists.');
  if (entry.type === 'workflow') {
    const location = index.workflows.get(id);
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
  if (!folderRoots) throw new Error('Workflow folder no longer exists.');
  for (const root of folderRoots) await rm(workflowFolderPath(root, id), { recursive: true, force: true });
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

async function readWorkflowStorage(roots: readonly StorageRoot[]): Promise<WorkflowStorageIndex> {
  const index: WorkflowStorageIndex = { entries: [], workflows: new Map(), folders: new Map() };
  const folderEntries = new Map<string, WorkflowRecordEntry>();

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
        const value = addLegacyWorkflowStepNames(JSON.parse(await readFile(recordPath, 'utf8')));
        if (!isWorkflowRecord(value) || child.name !== `${value.id}.json`) continue;
        if (index.workflows.has(value.id)) throw new Error('Duplicate workflow id.');
        index.workflows.set(value.id, { path: recordPath, root, parentId });
        index.entries.push({ id: value.id, name: value.name, type: 'workflow', parentId });
      } catch (error) {
        if (error instanceof Error && error.message === 'Duplicate workflow id.') throw error;
      }
    }
  };

  for (const root of roots) {
    if (!(await pathExists(root.directory))) continue;
    await migrateLegacyWorkflowStorage(root.directory);
    await visit(root, root.directory);
  }
  index.entries.push(...folderEntries.values());
  return index;
}

function workflowFolderPath(root: StorageRoot, folderId: string): string {
  return path.join(root.directory, ...folderId.split('/'));
}

async function migrateLegacyWorkflowStorage(directory: string): Promise<void> {
  const rootFiles = await readdir(directory, { withFileTypes: true });
  const legacyFolders = new Map<string, WorkflowFolderRecord>();
  const legacyWorkflows = new Map<string, WorkflowRecord>();

  for (const file of rootFiles) {
    if (!file.isFile() || !file.name.endsWith('.json')) continue;
    try {
      const value = addLegacyWorkflowStepNames(JSON.parse(await readFile(path.join(directory, file.name), 'utf8')));
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
    (record.description === undefined || typeof record.description === 'string') &&
    (record.enableAI === undefined || typeof record.enableAI === 'boolean') &&
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
  const workflow = value as { steps?: unknown; environment?: unknown };
  return (
    Array.isArray(workflow.steps) &&
    workflow.steps.every(isWorkflowStep) &&
    (workflow.environment === undefined ||
      (Array.isArray(workflow.environment) &&
        workflow.environment.every(isWorkflowEnvironmentVariable) &&
        new Set(workflow.environment.map((variable) => variable.name.toUpperCase())).size ===
          workflow.environment.length))
  );
}

function isWorkflowEnvironmentVariable(value: unknown): boolean {
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

function isWorkflowStep(value: unknown): boolean {
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

function addLegacyWorkflowStepNames(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as { workflow?: unknown };
  if (!record.workflow || typeof record.workflow !== 'object') return value;
  const workflow = record.workflow as { steps?: unknown };
  if (!Array.isArray(workflow.steps)) return value;
  return {
    ...record,
    workflow: {
      ...workflow,
      steps: workflow.steps.map((step, index) =>
        step && typeof step === 'object' && !('name' in step) ? { ...step, name: `Step ${index + 1}` } : step,
      ),
    },
  };
}
