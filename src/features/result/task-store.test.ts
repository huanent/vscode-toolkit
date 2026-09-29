import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ResultTask } from './protocol';
import { ResultTaskStore } from './task-store';

describe('result task store', () => {
  it('persists each task as JSON and loads it after reopening the store', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolkit-result-test-'));
    const directory = join(root, 'result2');
    const task: ResultTask = {
      id: 'task-1',
      kind: 'http',
      title: 'GET https://example.test',
      status: 'completed',
      createdAt: 1,
      updatedAt: 2,
      input: { method: 'GET' },
      output: { status: 200 },
    };

    try {
      const store = new ResultTaskStore(directory);
      await store.save(task);
      expect(await new ResultTaskStore(directory).list()).toEqual([task]);
      expect(JSON.parse(await readFile(join(directory, 'task-1.json'), 'utf8'))).toEqual(task);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('deletes a task record from history', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolkit-result-test-'));
    const directory = join(root, 'result2');
    const task: ResultTask = {
      id: 'task-2',
      kind: 'script',
      title: 'Run script',
      status: 'failed',
      createdAt: 1,
      updatedAt: 2,
      error: 'Exited with code 1',
    };

    try {
      const store = new ResultTaskStore(directory);
      await store.save(task);
      await store.delete(task.id);
      expect(await store.list()).toEqual([]);
      expect(await readdir(directory)).toEqual([]);
      await expect(store.delete('../outside')).rejects.toThrow('Invalid result task ID.');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
