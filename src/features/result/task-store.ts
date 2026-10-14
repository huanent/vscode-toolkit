import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { ResultTask, ResultTaskStatus } from './protocol';

const taskStatuses: ResultTaskStatus[] = ['running', 'completed', 'failed', 'cancelled', 'interrupted'];

export class ResultTaskStore {
  constructor(private readonly directory: string) {}

  public async list(): Promise<ResultTask[]> {
    await mkdir(this.directory, { recursive: true });
    const entries = await readdir(this.directory, { withFileTypes: true });
    const tasks: ResultTask[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

      try {
        const value: unknown = JSON.parse(await readFile(path.join(this.directory, entry.name), 'utf8'));
        if (isResultTask(value)) tasks.push(value);
      } catch (error) {
        if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
    }

    return tasks.sort((left, right) => right.createdAt - left.createdAt);
  }

  public async save(task: ResultTask): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const filePath = this.getFilePath(task.id);
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, JSON.stringify(task), 'utf8');
      await rename(temporaryPath, filePath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  public async delete(taskId: string): Promise<void> {
    await rm(this.getFilePath(taskId), { force: true });
  }

  private getFilePath(taskId: string): string {
    if (!/^[\w-]+$/.test(taskId)) throw new Error('Invalid result task ID.');
    return path.join(this.directory, `${taskId}.json`);
  }
}

function isResultTask(value: unknown): value is ResultTask {
  if (typeof value !== 'object' || value === null) return false;
  const task = value as Partial<ResultTask>;
  return (
    typeof task.id === 'string' &&
    /^[\w-]+$/.test(task.id) &&
    typeof task.kind === 'string' &&
    typeof task.title === 'string' &&
    typeof task.status === 'string' &&
    taskStatuses.includes(task.status as ResultTaskStatus) &&
    typeof task.createdAt === 'number' &&
    typeof task.updatedAt === 'number'
  );
}
