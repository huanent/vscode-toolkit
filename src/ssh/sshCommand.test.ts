import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectSshClient, type SshConnection } from './sshConnection';
import { executeSshCommand } from './sshCommand';
import type { SshServer } from './server';

vi.mock('./sshConnection', () => ({ connectSshClient: vi.fn() }));

function harness(ready = true, pty = false) {
    const stream = Object.assign(new EventEmitter(), {
        stderr: Object.assign(new EventEmitter(), { setEncoding: vi.fn() }),
        setEncoding: vi.fn(), signal: vi.fn(), close: vi.fn(), write: vi.fn(),
    });
    const dispose = vi.fn();
    const exec = vi.fn((_command, _options, callback) => callback(undefined, stream));
    const connection = { client: { exec }, dispose } as unknown as SshConnection;
    vi.mocked(connectSshClient).mockImplementation((_server, _credentials, onReady) => {
        if (ready) onReady(connection);
        return dispose;
    });
    const controller = new AbortController();
    const execution = executeSshCommand({} as SshServer, {}, 'long-command', controller.signal, undefined, { pty });
    return { stream, dispose, exec, connection, controller, execution };
}

describe('SSH command cancellation', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('sends Ctrl+C through the PTY and waits for remote channel closure', async () => {
        const test = harness(true, true);
        const rejected = expect(test.execution).rejects.toMatchObject({ name: 'AbortError' });
        expect(test.exec.mock.calls[0][1]).toMatchObject({ pty: { modes: { ISIG: 1, VINTR: 3 } } });
        test.controller.abort();
        expect(test.stream.write).toHaveBeenCalledWith('\x03');
        expect(test.stream.signal).not.toHaveBeenCalled();
        expect(test.dispose).not.toHaveBeenCalled();
        test.stream.emit('close', 130);
        await rejected;
        expect(test.dispose).toHaveBeenCalledOnce();
    });

    it('reports unconfirmed termination if Ctrl+C does not close the remote channel', async () => {
        vi.useFakeTimers();
        const test = harness(true, true);
        const rejected = expect(test.execution).rejects.toMatchObject({ name: 'SshCancellationUnconfirmedError' });
        test.controller.abort();
        await vi.advanceTimersByTimeAsync(10000);
        await rejected;
        expect(test.dispose).toHaveBeenCalledOnce();
    });

    it('sends TERM and reports cancellation when the channel closes', async () => {
        const test = harness();
        const rejected = expect(test.execution).rejects.toMatchObject({ name: 'AbortError' });
        test.controller.abort();
        expect(test.stream.signal).toHaveBeenCalledWith('TERM');
        test.stream.emit('close', 143);
        await rejected;
        expect(test.dispose).toHaveBeenCalledOnce();
    });

    it('attempts KILL and disconnects after two seconds without a close event', async () => {
        vi.useFakeTimers();
        const test = harness();
        const rejected = expect(test.execution).rejects.toMatchObject({ name: 'AbortError' });
        test.controller.abort();
        expect(test.dispose).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(2000);
        await rejected;
        expect(test.stream.signal.mock.calls).toEqual([['TERM'], ['KILL']]);
        expect(test.dispose).toHaveBeenCalledOnce();
    });

    it('cancels during connection setup and prevents late command execution', async () => {
        const test = harness(false);
        const rejected = expect(test.execution).rejects.toMatchObject({ name: 'AbortError' });
        test.controller.abort();
        await rejected;
        expect(test.dispose).toHaveBeenCalledOnce();
        vi.mocked(connectSshClient).mock.calls[0][2](test.connection);
        expect(test.exec).not.toHaveBeenCalled();
    });

    it('does not connect with an already aborted signal', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(executeSshCommand({} as SshServer, {}, 'command', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(connectSshClient).not.toHaveBeenCalled();
    });

    it('retains normal output and removes cancellation handling after completion', async () => {
        const test = harness();
        test.stream.emit('data', 'output\n');
        test.stream.emit('close', 0);
        await expect(test.execution).resolves.toBe('output');
        test.controller.abort();
        expect(test.stream.signal).not.toHaveBeenCalled();
        expect(test.dispose).toHaveBeenCalledOnce();
    });
});