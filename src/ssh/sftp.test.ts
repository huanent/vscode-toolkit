import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { connectSshClient, type SshConnection } from './sshConnection';
import { downloadSftpFile, writeSftpFile } from './sftp';
import type { SshServer } from './server';

vi.mock('./sshConnection', () => ({ connectSshClient: vi.fn() }));
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(async () => undefined) }));

describe('SFTP cancellation', () => {
    it.each(['upload', 'download'])('closes an active %s and ignores its late callback', async action => {
        let callback: (error?: Error) => void = () => { };
        const transfer = vi.fn((_source, _target, complete) => { callback = complete; });
        const channel = Object.assign(new EventEmitter(), { fastPut: transfer, fastGet: transfer, end: vi.fn() });
        const dispose = vi.fn();
        vi.mocked(connectSshClient).mockImplementation((_server, _credentials, ready) => {
            ready({ client: { sftp: (complete: Function) => complete(undefined, channel) }, dispose } as unknown as SshConnection);
            return dispose;
        });
        const controller = new AbortController();
        const execute = action === 'upload' ? writeSftpFile : downloadSftpFile;
        const execution = execute({} as SshServer, {}, '/source', '/target', controller.signal);
        const rejected = expect(execution).rejects.toMatchObject({ name: 'AbortError' });
        await vi.waitFor(() => expect(transfer).toHaveBeenCalledOnce());
        controller.abort();
        await rejected;
        expect(channel.end).toHaveBeenCalledOnce();
        expect(dispose).toHaveBeenCalledOnce();
        callback(new Error('Connection closed'));
        expect(dispose).toHaveBeenCalledOnce();
    });

    it('cancels connection setup without starting a late transfer', async () => {
        const dispose = vi.fn();
        const sftp = vi.fn();
        vi.mocked(connectSshClient).mockReturnValue(dispose);
        const controller = new AbortController();
        const execution = writeSftpFile({} as SshServer, {}, '/source', '/target', controller.signal);
        const rejected = expect(execution).rejects.toMatchObject({ name: 'AbortError' });
        controller.abort();
        await rejected;
        expect(dispose).toHaveBeenCalledOnce();
        vi.mocked(connectSshClient).mock.calls[0][2]({ client: { sftp }, dispose } as unknown as SshConnection);
        expect(sftp).not.toHaveBeenCalled();
    });

    it.each([writeSftpFile, downloadSftpFile])('does not connect when already aborted', async execute => {
        const controller = new AbortController();
        controller.abort();
        await expect(execute({} as SshServer, {}, '/source', '/target', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
        expect(connectSshClient).not.toHaveBeenCalled();
    });
});