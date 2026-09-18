import { describe, expect, it, vi } from 'vitest';
import { resolveConnectionCredentials, resolveFormCredentials } from './connectionCredentials';
import type { CredentialStore } from './store';

describe('connection credential references', () => {
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
            .toMatchObject({ username: 'db-user', authType: 'password', proxyUsername: 'ssh-user', proxyAuthType: 'privateKey' });
        await expect(resolveFormCredentials(store(), { password: 'legacy' }, 'ssh')).rejects.toThrow();
    });
});