import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { CredentialStore } from './store';

const directories: string[] = [];
afterEach(async () => {
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});
async function setup() {
    const directory = await mkdtemp(path.join(tmpdir(), 'toolkit-credential-'));
    directories.push(directory);
    const credentialDirectory = path.join(directory, 'credential');
    const store = new CredentialStore(credentialDirectory);
    return { store, directory: credentialDirectory, file: (id: string) => path.join(credentialDirectory, `${id}.json`) };
}

describe('CredentialStore', () => {
    it('returns a safe summary on save and resolves current secrets by ID', async () => {
        const { store } = await setup();
        const entry = await store.save({ name: 'SSH', type: 'password', user: 'alice', secret: 'first' });
        expect(entry).not.toHaveProperty('secret');
        expect(await store.get(entry.id)).toEqual({ ...entry, secret: 'first' });
        await store.save({ ...entry, user: 'bob', secret: 'second' });
        expect(await store.get(entry.id)).toMatchObject({ user: 'bob', secret: 'second' });
        await store.delete(entry.id);
        expect(await store.get(entry.id)).toBeUndefined();
    });
    it('stores all types without exposing secrets in lists, including concurrent writes', async () => {
        const { store, file, directory } = await setup();
        await Promise.all(['password', 'privateKey', 'apikey'].map(type =>
            store.save({ name: type, type, user: 'alice', secret: 'sensitive-value' })));
        const entries = await store.list();
        expect(entries).toHaveLength(3);
        expect(JSON.stringify(entries)).not.toContain('sensitive-value');
        expect(entries.find(entry => entry.type === 'apikey')?.user).toBe('');
        expect((await readdir(directory)).sort()).toEqual(entries.map(entry => `${entry.id}.json`).sort());
        for (const entry of entries) {
            expect(JSON.parse(await readFile(file(entry.id), 'utf8'))).toEqual({ ...entry, secret: 'sensitive-value' });
            if (process.platform !== 'win32') expect((await stat(file(entry.id))).mode & 0o777).toBe(0o600);
        }
        expect(await new CredentialStore(directory).list()).toEqual(entries);
    });

    it('preserves a secret on edit and deletes the complete credential', async () => {
        const { store, file } = await setup();
        await store.save({ name: 'Server', type: 'password', user: 'alice', secret: 'original' });
        const [entry] = await store.list();
        await store.save({ ...entry, name: 'Renamed', secret: '' });
        expect((await store.list())[0].name).toBe('Renamed');
        expect(await readFile(file(entry.id), 'utf8')).toContain('original');
        await store.delete(entry.id);
        expect(await store.list()).toEqual([]);
        await expect(readFile(file(entry.id), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('rejects invalid inputs and does not reuse secrets when changing type', async () => {
        const { store } = await setup();
        await expect(store.save({ name: 'Missing', type: 'apikey', user: '', secret: '' })).rejects.toThrow();
        await expect(store.save({ name: 'Missing', type: 'password', user: '', secret: 'secret' })).rejects.toThrow();
        await store.save({ name: 'Key', type: 'apikey', user: '', secret: 'key' });
        const [entry] = await store.list();
        await expect(store.save({ ...entry, type: 'privateKey', user: 'alice', secret: '' })).rejects.toThrow();
        expect((await store.list())[0].type).toBe('apikey');
    });

    it('does not overwrite malformed storage', async () => {
        const { store, file } = await setup();
        await store.save({ name: 'Key', type: 'apikey', user: '', secret: 'key' });
        const [entry] = await store.list();
        await writeFile(file(entry.id), '{}');
        await expect(store.save({ ...entry, secret: 'replacement' })).rejects.toThrow('Invalid credential storage');
        expect(await readFile(file(entry.id), 'utf8')).toBe('{}');
    });

    it('rejects IDs that escape the credential directory', async () => {
        const { store } = await setup();
        await expect(store.delete('../outside')).rejects.toThrow('Invalid credential ID');
        await expect(store.save({ id: '../outside', name: 'Key', type: 'apikey', user: '', secret: 'key' })).rejects.toThrow('Invalid credential ID');
    });
});