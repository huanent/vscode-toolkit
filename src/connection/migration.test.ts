import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrateConnections } from './migration';

describe('connection storage migration', () => {
    let root: string;
    beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'toolkit-connection-')); });
    afterEach(async () => { await rm(root, { recursive: true, force: true }); });

    it('merges all legacy directories, preserves order and nested data, and runs once', async () => {
        for (const type of ['ssh', 'database', 'container']) {
            await mkdir(join(root, type));
            await writeFile(join(root, type, `${type}.json`), JSON.stringify({ id: type, type }));
            await writeFile(join(root, type, 'order.json'), JSON.stringify({ serverIds: [type] }));
        }
        await mkdir(join(root, 'database', 'sql'));
        await writeFile(join(root, 'database', 'sql', 'query.sql'), 'select 1');
        await Promise.all([migrateConnections(root), migrateConnections(root)]);
        await migrateConnections(root);
        expect(await readdir(root)).toEqual(['connection']);
        for (const type of ['ssh', 'database', 'container']) {
            expect(JSON.parse(await readFile(join(root, 'connection', `${type}.json`), 'utf8'))).toEqual({ id: type, type });
            expect(JSON.parse(await readFile(join(root, 'connection', `${type}Order.json`), 'utf8'))).toEqual({ serverIds: [type] });
        }
        expect(await readFile(join(root, 'connection', 'sql', 'query.sql'), 'utf8')).toBe('select 1');
    });

    it('never overwrites a collision and can resume after it is resolved', async () => {
        await mkdir(join(root, 'ssh'));
        await mkdir(join(root, 'connection'));
        await writeFile(join(root, 'ssh', 'server.json'), 'original');
        await writeFile(join(root, 'connection', 'server.json'), 'existing');
        await expect(migrateConnections(root)).rejects.toThrow('would overwrite');
        expect(await readFile(join(root, 'ssh', 'server.json'), 'utf8')).toBe('original');
        expect(await readFile(join(root, 'connection', 'server.json'), 'utf8')).toBe('existing');
        await rm(join(root, 'connection', 'server.json'));
        await migrateConnections(root);
        expect(await readFile(join(root, 'connection', 'server.json'), 'utf8')).toBe('original');
        expect(await readdir(root)).toEqual(['connection']);
    });

    it('supports a fresh storage root without legacy directories', async () => {
        await migrateConnections(root);
        expect(await readdir(root)).toEqual([]);
    });
});