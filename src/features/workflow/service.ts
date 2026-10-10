import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { WorkflowDefinition, WorkflowFolderRecord, WorkflowRecord, WorkflowRecordEntry } from './protocol';

const entryNameCollator = new Intl.Collator(undefined, { numeric: true });

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
  await mkdir(directory, { recursive: true });
  const files = await readdir(directory, { withFileTypes: true });
  const records: WorkflowRecordEntry[] = [];
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith('.json')) continue;
    try {
      const value: unknown = JSON.parse(await readFile(path.join(directory, file.name), 'utf8'));
      if (file.name !== `${getRecordId(value)}.json`) continue;
      if (isWorkflowRecord(value)) {
        records.push({ id: value.id, name: value.name, type: 'workflow', parentId: value.parentId });
      } else if (isWorkflowFolderRecord(value)) {
        records.push({ id: value.id, name: value.name, type: 'folder', parentId: value.parentId });
      }
    } catch {
      // Ignore records that are invalid or no longer supported.
    }
  }
  return records.sort((first, second) => entryNameCollator.compare(first.name, second.name));
}

export async function readWorkflowRecord(directory: string, id: string): Promise<WorkflowRecord | undefined> {
  validateWorkflowId(id);
  try {
    const value: unknown = JSON.parse(await readFile(path.join(directory, `${id}.json`), 'utf8'));
    if (!isWorkflowRecord(value) || value.id !== id) throw new Error('Invalid workflow record.');
    return { ...value, kind: 'workflow' };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
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
  await validateParentFolder(directory, parentId);
  await mkdir(directory, { recursive: true });
  const record = { kind: 'workflow', id, name: name.trim(), parentId, workflow } satisfies WorkflowRecord;
  const target = path.join(directory, `${id}.json`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return record;
}

export async function deleteWorkflowRecord(directory: string, id: string): Promise<void> {
  validateWorkflowId(id);
  await rm(path.join(directory, `${id}.json`));
}

export async function saveWorkflowFolder(
  directory: string,
  name: string,
  parentId?: string,
): Promise<WorkflowFolderRecord> {
  const trimmedName = name.trim();
  if (!trimmedName || /[\\/\0]/.test(trimmedName)) throw new Error('Enter a valid folder name.');
  await validateParentFolder(directory, parentId);
  const records = await readWorkflowRecords(directory);
  if (records.some((record) => record.parentId === parentId && record.name === trimmedName)) {
    throw new Error(`"${trimmedName}" already exists in this folder.`);
  }
  const folder = { kind: 'folder', id: randomUUID(), name: trimmedName, parentId } satisfies WorkflowFolderRecord;
  await writeWorkflowRecordFile(directory, folder);
  return folder;
}

export async function deleteWorkflowEntry(directory: string, id: string): Promise<string[]> {
  validateWorkflowId(id);
  const records = await readWorkflowRecords(directory);
  if (!records.some((record) => record.id === id)) throw new Error('Workflow entry no longer exists.');
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const record of records) {
      if (record.parentId && ids.has(record.parentId) && !ids.has(record.id)) {
        ids.add(record.id);
        changed = true;
      }
    }
  }
  await Promise.all([...ids].map((recordId) => rm(path.join(directory, `${recordId}.json`), { force: true })));
  return [...ids];
}

export function validateWorkflowId(id: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Invalid workflow id.');
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
    (record.parentId === undefined || typeof record.parentId === 'string')
  );
}

function getRecordId(value: unknown): string | undefined {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string'
    ? value.id
    : undefined;
}

async function validateParentFolder(directory: string, parentId?: string): Promise<void> {
  if (!parentId) return;
  validateWorkflowId(parentId);
  const value: unknown = JSON.parse(await readFile(path.join(directory, `${parentId}.json`), 'utf8'));
  if (!isWorkflowFolderRecord(value)) throw new Error('The parent folder no longer exists.');
}

async function writeWorkflowRecordFile(directory: string, record: WorkflowFolderRecord): Promise<void> {
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, `${record.id}.json`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
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
