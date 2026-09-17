import { describe, expect, it, vi } from 'vitest';
import type { Result } from './protocol';
import { TaskRunner } from './taskRunner';

const result = (): Result => ({ type: 'http', data: { method: 'GET', url: 'https://example.com', state: 'loading' } });

describe('result task runner', () => {
    it('restores results newest first and cancels interrupted tasks', () => {
        const original = new TaskRunner(vi.fn());
        const newest = original.add(result(), vi.fn());
        newest.task.startedAt = 200;
        const oldest = original.add(result());
        oldest.task.startedAt = 100;
        const restored = new TaskRunner(vi.fn());
        restored.restore(JSON.parse(JSON.stringify([newest, oldest])));
        expect(restored.history.map(entry => entry.task.startedAt)).toEqual([200, 100]);
        const entry = restored.history[0];
        expect(entry.task).toMatchObject({ state: 'cancelled', cancellable: false });
        expect(entry.result.data).toMatchObject({ state: 'cancelled' });
        expect(restored.find(entry.result)).toBe(entry);
        restored.remove(entry.task.id);
        expect(restored.history).toHaveLength(1);
    });

    it('runs independently and cancels only the requested task', async () => {
        const runner = new TaskRunner(vi.fn());
        const first = result();
        const second = result();
        let completeSecond!: () => void;
        const firstRun = runner.run(first, async () => { }, signal => new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason));
        }));
        const secondRun = runner.run(second, async () => { }, () => new Promise(resolve => { completeSecond = resolve; }));
        await Promise.resolve();
        runner.cancel(runner.find(first)!.task.id);
        await firstRun;
        expect(runner.find(first)!.task.state).toBe('cancelled');
        expect(runner.find(second)!.task.state).toBe('running');
        if (second.type === 'http') second.data.state = 'success';
        completeSecond();
        await secondRun;
        expect(runner.find(second)!.task.state).toBe('success');
    });

    it('retains failures and deletes individual completed entries without removing active tasks', async () => {
        const runner = new TaskRunner(vi.fn());
        const failed = result();
        await runner.run(failed, async () => { }, async () => { throw new Error('Request failed'); });
        expect(failed.data).toMatchObject({ state: 'error', message: 'Request failed' });
        const active = runner.add(result(), vi.fn());
        runner.remove(active.task.id);
        expect(runner.find(failed)).toBeDefined();
        runner.remove(runner.find(failed)!.task.id);
        expect([...runner.entries.keys()]).toEqual([active.task.id]);
    });
});