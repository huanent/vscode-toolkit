import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeLocalCommand } from './localCommand';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

describe('local command cancellation', () => {
    afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

    it('escalates an unresponsive command and stops waiting after two seconds', async () => {
        vi.useFakeTimers();
        const child = Object.assign(new EventEmitter(), {
            stdout: Object.assign(new EventEmitter(), { setEncoding: vi.fn(), destroy: vi.fn() }),
            stderr: Object.assign(new EventEmitter(), { setEncoding: vi.fn(), destroy: vi.fn() }),
            kill: vi.fn(), unref: vi.fn(),
        });
        vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
        const controller = new AbortController();
        const execution = executeLocalCommand('command', '/tmp', vi.fn(), controller.signal);
        const rejected = expect(execution).rejects.toMatchObject({ name: 'AbortError' });
        controller.abort();
        expect(child.kill).toHaveBeenCalledWith('SIGTERM');
        await vi.advanceTimersByTimeAsync(2000);
        await rejected;
        expect(child.kill).toHaveBeenCalledWith('SIGKILL');
        expect(child.stdout.destroy).toHaveBeenCalledOnce();
        expect(child.stderr.destroy).toHaveBeenCalledOnce();
    });

    it('does not spawn an already cancelled command', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(executeLocalCommand('command', '/tmp', vi.fn(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(spawn).not.toHaveBeenCalled();
    });
});