import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ResultTaskService } from './task-service';

describe('result task service', () => {
  it('cancels a running task and preserves the cancelled record across reloads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolkit-result-test-'));
    const directory = join(root, 'result2');
    const service = new ResultTaskService();
    await service.initialize(directory);
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });

    try {
      const taskId = await service.startTask({
        kind: 'http',
        title: 'GET https://example.test',
        input: { method: 'GET' },
        run: (signal) =>
          new Promise<never>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
            markStarted();
          }),
      });
      await started;
      await service.terminateTask(taskId);

      expect(service.getTask(taskId)).toMatchObject({ status: 'cancelled', error: 'Task was terminated.' });

      const reloadedService = new ResultTaskService();
      await reloadedService.initialize(directory);
      expect(reloadedService.getTask(taskId)).toMatchObject({ status: 'cancelled' });
      await reloadedService.deleteTask(taskId);
      expect(reloadedService.getState().tasks).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('marks tasks left running after a restart as interrupted', async () => {
    const root = await mkdtemp(join(tmpdir(), 'toolkit-result-test-'));
    const directory = join(root, 'result2');
    const originalService = new ResultTaskService();
    await originalService.initialize(directory);

    try {
      const taskId = await originalService.startTask({
        kind: 'build',
        title: 'Build project',
        run: () => new Promise<never>(() => undefined),
      });
      const reloadedService = new ResultTaskService();
      await reloadedService.initialize(directory);

      expect(reloadedService.getTask(taskId)).toMatchObject({
        status: 'interrupted',
        error: 'Task was interrupted when VS Code closed.',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
