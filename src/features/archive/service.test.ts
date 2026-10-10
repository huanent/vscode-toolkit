import { describe, expect, it } from 'vitest';
import { ZipFile } from 'yazl';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Uri } from 'vscode';
import { readArchiveTree, validateArchiveUri } from './service';

describe('ZIP directory reader', () => {
    it('reads file metadata and empty folders from disk without extracting payloads', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'toolkit-zip-test-'));
        try {
            const filename = join(directory, 'sample.zip');
            const zip = new ZipFile();
            zip.addBuffer(Buffer.from('hello'), 'folder/hello.txt');
            zip.addEmptyDirectory('empty/');
            zip.end();
            await pipeline(zip.outputStream, createWriteStream(filename));
            expect(await readArchiveTree({ scheme: 'file', path: filename, fsPath: filename } as Uri)).toEqual([
                { name: 'empty', type: 'directory', size: 0, children: [] },
                { name: 'folder', type: 'directory', size: 0, children: [{ name: 'hello.txt', type: 'file', size: 5 }] },
            ]);
        } finally {
            await rm(directory, { recursive: true, force: true });
        }
    });
    it.each(['7z', 'tar.gz', 'rar'])('rejects unsupported %s files', suffix => {
        expect(() => validateArchiveUri({ path: `/sample.${suffix}` } as Uri)).toThrow('Only ZIP');
    });
    it.each(['zip', 'ZIP'])('accepts %s suffixes', suffix => {
        expect(() => validateArchiveUri({ path: `/sample.${suffix}` } as Uri)).not.toThrow();
    });
    it('rejects remote resources without reading or downloading them', async () => {
        await expect(readArchiveTree({ scheme: 'vscode-remote', path: '/sample.zip' } as Uri)).rejects.toThrow('will not be downloaded');
    });
});