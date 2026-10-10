import { describe, expect, it, vi } from 'vitest';
import { resolveConnectionCredentials, resolveFormCredentials } from './connectionCredentials';
import type { CredentialStore } from './store';
import { parseServer as parseSshServer, parseServerExport as parseSshExport } from '../ssh/server';
import { parseServer as parseDatabaseServer, parseServerExport as parseDatabaseExport } from '../database/server';
import { parseServer as parseContainerServer, parseServerExport as parseContainerExport } from '../container/server';

describe('connections without credential references', () => {
    const network = { id: 'connection', name: 'Connection', host: 'localhost', port: 22, username: 'user' };
    const proxy = { host: 'proxy', port: 22, username: 'proxy-user', authType: 'password' };
    it.each([
        { type: 'ssh', parse: parseSshServer, parseExport: parseSshExport, data: { ...network, type: 'ssh', proxy } },
        { type: 'database', parse: parseDatabaseServer, parseExport: parseDatabaseExport, data: { ...network, type: 'mysql', database: 'test', proxy } },
        { type: 'container', parse: parseContainerServer, parseExport: parseContainerExport, data: { ...network, type: 'container', connectionType: 'ssh', runtime: 'docker', executablePath: 'docker' } },
    ])('keeps $type connections available for editing and import', ({ parse, parseExport, data }) => {
        const server = parse(data);
        expect(server).toMatchObject({ id: network.id, host: network.host, port: network.port, credentialId: '' });
        expect(server).not.toHaveProperty('username');
        expect(server).not.toHaveProperty('authType');
        if ('proxy' in server) expect(server.proxy).toEqual({ host: proxy.host, port: proxy.port, credentialId: '' });
        expect(parse(JSON.parse(JSON.stringify(server)))).toEqual(server);
        expect(parseExport({ servers: [data] })).toEqual([server]);
        expect(() => parse({ ...data, port: 0 })).toThrow('Invalid server');
    });
});

describe('connection credential references', () => {
    it('parses credential-only identities for SSH, MySQL, proxies and containers', () => {
        const credentials = [
            { id: 'password', name: 'Password', type: 'password' as const, user: 'db-user' },
            { id: 'key', name: 'Key', type: 'privateKey' as const, user: 'ssh-user' },
            { id: 'api', name: 'API', type: 'apikey' as const, user: '' },
        ];
        const network = { id: 'connection', name: 'Connection', host: 'localhost', port: 22, credentialId: 'key' };
        const proxy = { host: 'proxy', port: 22, credentialId: 'password' };
        const servers = [
            parseSshServer({ ...network, type: 'ssh', proxy }, credentials),
            parseDatabaseServer({ ...network, type: 'mysql', credentialId: 'password', database: 'app' }, credentials),
            parseContainerServer({ ...network, type: 'container', runtime: 'docker', executablePath: 'docker', connectionType: 'ssh' }, credentials),
        ];
        for (const server of servers) {
            expect(server).toHaveProperty('credentialId');
            expect(JSON.stringify(server)).not.toMatch(/"(username|authType)"/);
            expect(JSON.stringify(server)).not.toContain('ssh-user');
        }
        for (const credentialId of ['missing', 'api', 'key']) {
            expect(() => parseDatabaseServer({ ...network, type: 'mysql', credentialId, database: 'app' }, credentials)).toThrow('credential');
        }
        expect(parseSshServer({ ...network, type: 'ssh', username: 'stale', authType: 'password' }, credentials))
            .toEqual(parseSshServer({ ...network, type: 'ssh' }, credentials));
    });

    const password = { id: 'password', name: 'Password', type: 'password', user: 'db-user', secret: 'secret' };
    const privateKey = { id: 'key', name: 'Key', type: 'privateKey', user: 'ssh-user', secret: 'private-key', passphrase: 'phrase' };
    const api = { id: 'api', name: 'API', type: 'apikey', user: '', secret: 'token' };
    function store() {
        return { get: vi.fn(async (id: string) => [password, privateKey, api].find(entry => entry.id === id)) } as unknown as CredentialStore;
    }
    it('resolves current users, types and private key passphrases for primary and proxy credentials', async () => {
        expect(await resolveConnectionCredentials(store(), { type: 'mysql', credentialId: 'password', proxy: { credentialId: 'key' } }))
            .toEqual({ username: 'db-user', authType: 'password', password: 'secret', proxyUsername: 'ssh-user', proxyAuthType: 'privateKey', proxyPrivateKey: 'private-key', proxyPassphrase: 'phrase' });
        expect(await resolveConnectionCredentials(store(), { type: 'container', connectionType: 'ssh', credentialId: 'key' }))
            .toMatchObject({ username: 'ssh-user', privateKey: 'private-key', passphrase: 'phrase' });
    });
    it('rejects missing references, API keys and private keys for MySQL without legacy fallback', async () => {
        for (const credentialId of [undefined, 'missing', 'api', 'key']) {
            await expect(resolveConnectionCredentials(store(), { type: 'mysql', credentialId })).rejects.toThrow();
        }
    });
    it('does not require credentials for local containers or containers referencing SSH connections', async () => {
        const credentials = store();
        expect(await resolveConnectionCredentials(credentials, { type: 'container', connectionType: 'local' })).toEqual({});
        expect(await resolveConnectionCredentials(credentials, { type: 'container', connectionType: 'ssh', sshServerId: 'ssh' })).toEqual({});
        expect(credentials.get).not.toHaveBeenCalled();
    });
    it('validates form references and ignores submitted identity in favor of the credential', async () => {
        expect(await resolveFormCredentials(store(), { credentialId: 'password', username: 'wrong', proxyEnabled: true, proxyCredentialId: 'key' }, 'database'))
            .toEqual({ credentialId: 'password', proxyEnabled: true, proxyCredentialId: 'key' });
        await expect(resolveFormCredentials(store(), { password: 'legacy' }, 'ssh')).rejects.toThrow();
    });
});