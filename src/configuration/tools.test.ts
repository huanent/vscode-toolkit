import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
    Disposable: class {
        constructor(private readonly callback: () => void) { }
        dispose() { this.callback(); }
        static from(...disposables: { dispose(): void }[]) {
            return { dispose() { disposables.forEach(disposable => disposable.dispose()); } };
        }
    },
    lm: { registerTool: vi.fn(() => ({ dispose() { } })) },
}));
vi.mock('../ssh/connectionService', () => ({ listSshConnections: () => [] }));

import { configurations, registerConnectionConfigurations, registerCredentialConfigurations } from './tools';
import type { WritableConfigurationType } from './service';
import { registerWorkflowTools } from '../workflow/tools';
import type { WorkflowStore } from '../workflow/store';
import { parseServer as parseSsh } from '../ssh/server';
import { parseServer as parseDatabase } from '../database/server';
import { parseServer as parseContainer } from '../container/server';

const disposables: { dispose(): void }[] = [];
afterEach(() => { disposables.splice(0).forEach(disposable => disposable.dispose()); });

describe('connection configuration adapters', () => {
    it('creates validated workflows without executing them', async () => {
        const store = { list: vi.fn(async () => []), save: vi.fn(async () => { }), getLocation: () => '' };
        const run = vi.fn(async () => true);
        disposables.push(registerWorkflowTools(store as unknown as WorkflowStore, run));
        const configuration = { name: 'Build', steps: [{ name: 'Build', type: 'command', command: 'npm run build', cwd: '${workspaceFolder}' }] };
        const created = await configurations.create('workflow', configuration);
        expect(created.id).toMatch(/^[a-f0-9-]{36}$/);
        expect(store.save).toHaveBeenCalledWith({ ...configuration, id: created.id, description: '' }, undefined);
        expect(run).not.toHaveBeenCalled();
        store.save.mockClear();
        await expect(configurations.create('workflow', { name: 'Invalid', steps: [{ name: 'Remote', type: 'ssh', serverId: 'missing', command: 'pwd' }] })).rejects.toThrow('not enabled for AI');
        expect(store.save).not.toHaveBeenCalled();
    });
    it('exposes only credential metadata and prohibits writes', async () => {
        const list = vi.fn(async () => [{ id: 'credential-1', name: 'Login', type: 'password' as const, user: 'admin', secret: 'hidden-secret', passphrase: 'hidden-passphrase' }]);
        disposables.push(registerCredentialConfigurations({ list }));
        expect(await configurations.read('credential')).toEqual([{
            type: 'credential', id: 'credential-1', location: '',
            configuration: { id: 'credential-1', name: 'Login', type: 'password', user: 'admin' },
        }]);
        expect(await configurations.read(undefined, 'hidden-secret|hidden-passphrase')).toEqual([]);
        await expect(configurations.edit('credential-1', [{ oldString: 'Login', newString: 'Changed' }])).rejects.toThrow('read-only');
        await expect(configurations.create('credential' as WritableConfigurationType, { name: 'New' })).rejects.toThrow('read-only');
    });
    const cases = [
        { type: 'ssh' as const, parse: parseSsh, fields: { type: 'ssh', host: 'example.com', port: 22, credentialId: 'credential-1', username: 'user', authType: 'password', commands: [] } },
        { type: 'database' as const, parse: parseDatabase, fields: { type: 'mysql', host: 'example.com', port: 3306, username: 'user', credentialId: 'credential-1', database: 'app' } },
        { type: 'container' as const, parse: parseContainer, fields: { type: 'container', runtime: 'docker', executablePath: 'docker', connectionType: 'local' } },
    ];
    for (const { type, parse, fields } of cases) {
        it(`reads and patches ${type} through its store while respecting AI access`, async () => {
            disposables.push(registerCredentialConfigurations({
                list: async () => [
                    { id: 'credential-1', name: 'Login', type: 'password', user: 'user' },
                    { id: 'credential-2', name: 'Other login', type: 'password', user: 'other-user' },
                ]
            }));
            const servers = [
                parse({ ...fields, id: 'enabled', name: 'Original', group: '', aiEnabled: true }),
                parse({ ...fields, id: 'disabled', name: 'Private', group: '', aiEnabled: false }),
            ];
            const store = {
                getServers: () => servers,
                readText: async (id: string) => JSON.stringify(servers.find(server => server.id === id)),
                getLocation: () => '',
                saveServer: vi.fn(async () => { }),
            };
            disposables.push(registerConnectionConfigurations(type, store, parse));
            expect(await configurations.read(type)).toHaveLength(2);
            expect((await configurations.read(type)).map(entry => entry.configuration.name)).toEqual(['Original', 'Private']);
            await expect(configurations.edit('disabled', [{ oldString: 'Private', newString: 'Changed' }])).rejects.toThrow('not enabled for AI');
            const updated = await configurations.edit('enabled', [{ oldString: '"name":"Original"', newString: '"name":"Updated"' }]);
            expect(updated.configuration.name).toBe('Updated');
            expect(store.saveServer).toHaveBeenCalledWith({ ...servers[0], name: 'Updated' }, '');
            store.saveServer.mockClear();
            await expect(configurations.edit('enabled', [{ oldString: '"name": "Original"', newString: '"name": "Original", "password": "secret"' }])).rejects.toThrow('unsupported');
            expect(store.saveServer).not.toHaveBeenCalled();
            const input: Record<string, unknown> = { ...fields };
            delete input.type;
            delete input.username;
            delete input.authType;
            const created = await configurations.create(type, { ...input, name: 'New connection' });
            expect(created.id).not.toBe('enabled');
            expect(created.configuration.aiEnabled).toBe(true);
            expect(created.configuration.name).toBe('New connection');
            expect(store.saveServer).toHaveBeenCalledWith(expect.objectContaining({ id: created.id, aiEnabled: true }), undefined);
            const forcedEnabled = await configurations.create(type, { ...input, name: 'New connection', aiEnabled: false });
            expect(forcedEnabled.configuration.aiEnabled).toBe(true);
            expect(store.saveServer).toHaveBeenLastCalledWith(expect.objectContaining({ id: forcedEnabled.id, aiEnabled: true }), undefined);
            if (type !== 'container') {
                const edited = await configurations.edit('enabled', [{ oldString: '"credential-1"', newString: '"credential-2"' }]);
                expect(edited.configuration.credentialId).toBe('credential-2');
                expect(edited.configuration).not.toHaveProperty('username');
                expect(edited.configuration).not.toHaveProperty('authType');
                await expect(configurations.create(type, { ...input, name: 'Missing credential', credentialId: 'missing' })).rejects.toThrow('credential');
            }
            store.saveServer.mockClear();
            await expect(configurations.create(type, { ...input, name: 'New', secret: 'forbidden' })).rejects.toThrow('unsupported');
            await expect(configurations.create(type, { ...input, name: 'New', id: 'enabled' })).rejects.toThrow('must not include id');
            await expect(configurations.create(type, { ...input, name: 'New' }, '', () => true)).rejects.toThrow('cancelled');
            expect(store.saveServer).not.toHaveBeenCalled();
        });
    }
});