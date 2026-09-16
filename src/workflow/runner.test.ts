import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { spawn } from 'node:child_process';
import type { ResultView } from '../result/resultView';
import type { Result } from '../result/protocol';
import { WorkflowRunner } from './runner';
import type { Workflow } from './workflow';
import { resolveSshConnection } from '../ssh/connectionService';
import { executeSshCommand } from '../ssh/sshCommand';
import { downloadSftpFile, writeSftpFile } from '../ssh/sftp';

vi.mock('vscode', () => ({
    commands: { registerCommand: vi.fn(), executeCommand: vi.fn() },
    CancellationTokenSource: class {
        listeners = new Set<() => void>();
        token = {
            isCancellationRequested: false,
            onCancellationRequested: (listener: () => void) => {
                this.listeners.add(listener);
                return { dispose: () => this.listeners.delete(listener) };
            },
        };
        cancel() {
            if (this.token.isCancellationRequested) return;
            this.token.isCancellationRequested = true;
            this.listeners.forEach(listener => listener());
        }
        dispose() { this.listeners.clear(); }
    },
}));
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
vi.mock('../ssh/connectionService', () => ({ resolveSshConnection: vi.fn() }));
vi.mock('../ssh/sshCommand', () => ({ executeSshCommand: vi.fn() }));
vi.mock('../ssh/sftp', () => ({ downloadSftpFile: vi.fn(), writeSftpFile: vi.fn() }));

const workflow: Workflow = {
    id: 'build', name: 'Build', steps: [
        { name: 'First', type: 'command', command: 'first', cwd: '/tmp' },
        { name: 'Second', type: 'command', command: 'second', cwd: '/tmp' },
    ],
};

function harness() {
    const child = Object.assign(new EventEmitter(), {
        kill: vi.fn(),
        stdout: Object.assign(new EventEmitter(), { setEncoding: vi.fn() }),
        stderr: Object.assign(new EventEmitter(), { setEncoding: vi.fn() }),
    });
    vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>);
    const view = { show: vi.fn(async (_result: Result) => { }), update: vi.fn() };
    const runner = new WorkflowRunner(view as unknown as ResultView);
    const result = () => view.show.mock.calls[0][0];
    const cancel = () => vi.mocked(vscode.commands.registerCommand).mock.calls[0][1]();
    return { child, view, runner, result, cancel };
}

describe('workflow result runner', () => {
    beforeEach(() => {
        vi.mocked(vscode.commands.registerCommand).mockReturnValue({ dispose: vi.fn() });
    });

    it.each(['upload', 'download'] as const)('aborts an active SFTP %s and skips later steps', async action => {
        const test = harness();
        vi.mocked(resolveSshConnection).mockResolvedValue({ server: {}, credentials: {} } as Awaited<ReturnType<typeof resolveSshConnection>>);
        const transfer = vi.mocked(action === 'upload' ? writeSftpFile : downloadSftpFile);
        transfer.mockImplementation((_server, _credentials, _source, _target, signal) => new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(new DOMException('Transfer cancelled.', 'AbortError')), { once: true });
        }));
        const execution = test.runner.run({
            ...workflow, steps: [
                { type: 'sftp', action, name: 'Transfer', serverId: 'server', localPath: '/local', remotePath: '/remote' },
                workflow.steps[0],
            ]
        });
        await vi.waitFor(() => expect(transfer).toHaveBeenCalledOnce());
        test.cancel();
        await expect(execution).resolves.toBe(false);
        expect(transfer.mock.calls[0][4]?.aborted).toBe(true);
        expect(test.result().data).toMatchObject({ state: 'cancelled' });
        expect(spawn).not.toHaveBeenCalled();
        test.runner.dispose();
    });

    it.each(['panel', 'tool'])('aborts an active SSH command through %s cancellation', async source => {
        const test = harness();
        vi.mocked(resolveSshConnection).mockResolvedValue({ server: {}, credentials: {} } as Awaited<ReturnType<typeof resolveSshConnection>>);
        vi.mocked(executeSshCommand).mockImplementation((_server, _credentials, _command, signal) => new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(new DOMException('SSH command cancelled.', 'AbortError')), { once: true });
        }));
        const token = new vscode.CancellationTokenSource();
        const execution = test.runner.run({
            ...workflow, steps: [
                { type: 'ssh', name: 'Remote', serverId: 'server', command: 'long-command' },
                workflow.steps[0],
            ]
        }, token.token);
        await vi.waitFor(() => expect(executeSshCommand).toHaveBeenCalledOnce());
        if (source === 'panel') test.cancel();
        else token.cancel();
        await expect(execution).resolves.toBe(false);
        expect(vi.mocked(executeSshCommand).mock.calls[0][3]?.aborted).toBe(true);
        expect(test.result().data).toMatchObject({ state: 'cancelled', summary: 'Workflow cancelled.' });
        expect(spawn).not.toHaveBeenCalled();
        token.dispose();
        test.runner.dispose();
    });

    it('captures stdout and stderr and completes without reopening Result', async () => {
        const test = harness();
        const execution = test.runner.run({ ...workflow, steps: workflow.steps.slice(0, 1) });
        await vi.waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
        test.child.stdout.emit('data', 'output\n');
        test.child.stderr.emit('data', 'warning\n');
        test.child.emit('close', 0);
        await expect(execution).resolves.toBe(true);
        expect(test.result().data).toMatchObject({ state: 'success', output: expect.stringContaining('output\nwarning\n') });
        expect(test.view.show).toHaveBeenCalledTimes(1);
        test.runner.dispose();
    });

    it.each(['panel', 'tool'])('terminates the local command on %s cancellation and skips later steps', async source => {
        const test = harness();
        const token = new vscode.CancellationTokenSource();
        const execution = test.runner.run(workflow, token.token);
        await vi.waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
        if (source === 'panel') test.cancel();
        else token.cancel();
        expect(test.result().data).toMatchObject({ state: 'stopping' });
        expect(test.child.kill).toHaveBeenCalledWith('SIGTERM');
        test.child.emit('close', 0);
        await expect(execution).resolves.toBe(false);
        expect(spawn).toHaveBeenCalledTimes(1);
        expect(test.result().data).toMatchObject({ state: 'cancelled' });
        token.dispose();
        test.runner.dispose();
    });

    it('retains command failure output', async () => {
        const test = harness();
        const execution = test.runner.run(workflow);
        const rejected = expect(execution).rejects.toThrow('Command exited with 1.');
        await vi.waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
        test.child.stderr.emit('data', 'failure details\n');
        test.child.emit('close', 1);
        await rejected;
        expect(test.result().data).toMatchObject({ state: 'error', output: expect.stringContaining('failure details') });
        expect(spawn).toHaveBeenCalledTimes(1);
        test.runner.dispose();
    });
});