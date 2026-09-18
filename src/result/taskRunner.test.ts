import { describe, expect, it, vi } from 'vitest';
import type { Result } from './protocol';
import { TaskRunner } from './taskRunner';

const result = (): Result => ({ type: 'http', data: { method: 'GET', url: 'https://example.com', state: 'loading' } });

describe('result task runner', () => {
    it('restores external results without cancelling or granting control', () => {
        const original = new TaskRunner(vi.fn());
        const newest = original.add(result(), vi.fn());
        newest.task.startedAt = 200;
        const oldest = original.add(result());
        oldest.task.startedAt = 100;
        const restored = new TaskRunner(vi.fn());
        restored.restore(JSON.parse(JSON.stringify([newest, oldest])), new Set([original.sessionId]));
        expect(restored.history.map(entry => entry.task.startedAt)).toEqual([200, 100]);
        const entry = restored.history[0];
        expect(entry.task).toMatchObject({ state: 'running', cancellable: false, executionStatus: 'external' });
        expect(entry.result.data).toMatchObject({ state: 'loading' });
        expect(restored.find(entry.result)).toBe(entry);
        restored.cancel(entry.task.id);
        restored.remove(entry.task.id);
        expect(restored.history).toHaveLength(2);
        restored.restore(JSON.parse(JSON.stringify([newest, oldest])));
        expect(restored.history[0].task.executionStatus).toBe('unknown');
    });

    it('merges external updates and deletion without replacing local execution', () => {
        const owner = new TaskRunner(vi.fn());
        const observer = new TaskRunner(vi.fn());
        const external = owner.add(result(), vi.fn());
        const local = observer.add(result(), vi.fn());
        observer.restore(JSON.parse(JSON.stringify(owner.history)));
        const previous = observer.entries.get(external.task.id)!;
        external.task.state = 'success';
        observer.restore(JSON.parse(JSON.stringify([...owner.history, local])));
        expect(observer.entries.get(external.task.id)!.task.state).toBe('success');
        expect(observer.find(previous.result)).toBeUndefined();
        expect(observer.entries.get(local.task.id)).toBe(local);
        expect(local.cancel).toBeDefined();
        observer.restore([]);
        expect(observer.history).toEqual([local]);
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