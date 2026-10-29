import { randomUUID } from 'node:crypto';
import { link, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { ResultTask, ResultTaskStatus, ResultTaskSummary } from './protocol';

const taskStatuses: ResultTaskStatus[] = ['running', 'completed', 'failed', 'cancelled', 'interrupted'];

export class ResultTaskStore {
  constructor(private readonly directory: string) {}

  public async list(before?: string, limit = 30): Promise<{ tasks: ResultTask[]; hasMore: boolean }> {
    await mkdir(this.directory, { recursive: true });
    const entries = await readdir(this.directory, { withFileTypes: true });
    const tasks: ResultTask[] = [];
    const names = entries
      .filter((entry) => entry.isFile() && /^\d+(?:-[\da-f-]+)?\.json$/.test(entry.name))
      .map((entry) => entry.name.slice(0, -5))
      .filter((id) => before === undefined || compareTaskIds(id, before) < 0)
      .sort((left, right) => compareTaskIds(right, left));
    let index = 0;
    for (; index < names.length && tasks.length < limit; index++) {
      try {
        const value: unknown = JSON.parse(await readFile(this.getFilePath(names[index]!), 'utf8'));
        if (isResultTask(value)) tasks.push(value);
      } catch (error) {
        if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
    }

    return { tasks, hasMore: index < names.length };
  }

  public async save(task: ResultTask): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const filePath = this.getFilePath(task.id);
    const { id, kind, title, status, createdAt, updatedAt } = task;
    const summary: ResultTaskSummary = { id, kind, title, status, createdAt, updatedAt };
    await this.writeAtomic(`${filePath.slice(0, -5)}.detail.json`, task);
    await this.writeAtomic(filePath, summary);
  }

  public async create(task: ResultTask, reservedIds: Set<string>): Promise<ResultTask> {
    await mkdir(this.directory, { recursive: true });
    let id = Number(task.id);
    while (true) {
      const candidate = String(id++);
      if (candidate !== task.id && reservedIds.has(candidate)) continue;
      const result = { ...task, id: candidate };
      const detailPath = this.getDetailPath(candidate);
      const temporaryPath = `${detailPath}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, JSON.stringify(result), 'utf8');
        try {
          await link(temporaryPath, detailPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue;
          throw error;
        }
        const { kind, title, status, createdAt, updatedAt } = result;
        await this.writeAtomic(this.getFilePath(candidate), {
          id: candidate,
          kind,
          title,
          status,
          createdAt,
          updatedAt,
        });
        return result;
      } finally {
        await rm(temporaryPath, { force: true });
      }
    }
  }

  public async read(taskId: string): Promise<ResultTask> {
    const value: unknown = JSON.parse(await readFile(this.getDetailPath(taskId), 'utf8'));
    if (!isResultTask(value)) throw new Error('Invalid result task.');
    return value;
  }

  private async writeAtomic(filePath: string, value: unknown): Promise<void> {
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, JSON.stringify(value), 'utf8');
      await rename(temporaryPath, filePath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  public async delete(taskId: string): Promise<void> {
    await rm(this.getFilePath(taskId), { force: true });
    await rm(this.getDetailPath(taskId), { force: true });
  }

  private getFilePath(taskId: string): string {
    if (!/^\d+(?:-[\da-f-]+)?$/.test(taskId)) throw new Error('Invalid result task ID.');
    return path.join(this.directory, `${taskId}.json`);
  }

  private getDetailPath(taskId: string): string {
    return this.getFilePath(taskId).replace(/\.json$/, '.detail.json');
  }
}

function compareTaskIds(left: string, right: string): number {
  return Number(left.split('-')[0]) - Number(right.split('-')[0]) || left.localeCompare(right);
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
