import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as yauzl from 'yauzl';
import { backupStorage } from './storageBackup';

describe('storage backup', () => {
    let root: string;
    const today = new Date(2026, 8, 20, 12);
    const filename = `${new Date(2026, 8, 20).getTime()}.zip`;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'toolkit-backup-')); });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });

    it('backs up connection and legacy directories, including nested files, once per local day', async () => {
        for (const directory of ['credential', 'connection', 'database', 'ssh', 'container', 'workflow', 'chat']) {
            await mkdir(join(root, directory, 'nested'), { recursive: true });
            await writeFile(join(root, directory, 'nested', 'data.json'), directory);
        }
        await backupStorage(root, today);
        const file = join(root, 'archive', filename);
        const original = await readFile(file);
        const zip = await yauzl.openPromise(file);
        const contents: Record<string, string> = {};
        try {
            for await (const entry of zip.eachEntry()) {
                if (entry.fileName.endsWith('/')) continue;
                const stream = await zip.openReadStreamPromise(entry);
                const chunks: Buffer[] = [];
                for await (const chunk of stream) chunks.push(Buffer.from(chunk));
                contents[entry.fileName] = Buffer.concat(chunks).toString();
            }
        } finally { zip.close(); }
        expect(contents).toEqual(Object.fromEntries(['credential', 'connection', 'database', 'ssh', 'container', 'workflow'].map(directory => [`${directory}/nested/data.json`, directory])));
        await writeFile(join(root, 'credential', 'nested', 'data.json'), 'changed');
        await backupStorage(root, new Date(2026, 8, 20, 23));
        expect(await readFile(file)).toEqual(original);
        expect(await readdir(join(root, 'archive'))).toEqual([filename]);
        if (process.platform !== 'win32') expect((await stat(file)).mode & 0o777).toBe(0o600);
        await backupStorage(root, new Date(2026, 8, 21));
        expect(await readdir(join(root, 'archive'))).toHaveLength(2);
    });

    it('removes backups older than one calendar year, even when today is already backed up', async () => {
        await backupStorage(root, today);
        const expired = `${new Date(2025, 8, 19).getTime()}.zip`;
        const boundary = `${new Date(2025, 8, 20).getTime()}.zip`;
        for (const name of [expired, boundary, 'manual.zip']) await writeFile(join(root, 'archive', name), 'keep');
        await backupStorage(root, today);
        expect((await readdir(join(root, 'archive'))).sort()).toEqual([boundary, filename, 'manual.zip'].sort());
    });

    it('handles missing source directories and concurrent backup attempts', async () => {
        await Promise.all([backupStorage(root, today), backupStorage(root, today)]);
        expect(await readdir(join(root, 'archive'))).toEqual([filename]);
    });
});