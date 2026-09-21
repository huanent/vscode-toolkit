import { describe, expect, it, vi } from 'vitest';
import { ConfigurationService, type ConfigurationEntry } from './service';

function setup() {
    const service = new ConfigurationService();
    let entry: ConfigurationEntry = {
        type: 'ssh', id: 'server-1', location: '',
        configuration: { id: 'server-1', name: 'Production', host: 'example.com', aiEnabled: true },
    };
    const update = vi.fn(async (_current: ConfigurationEntry, configuration: Record<string, unknown>, location: string) => {
        entry = { ...entry, configuration, location };
        return entry;
    });
    service.register('ssh', { list: async () => [entry], update });
    return { service, update };
}

describe('ConfigurationService', () => {
    it.each([
        ['ssh', 'ssh'],
        ['database', 'mysql'],
        ['container', 'container'],
        ['workflow', undefined],
    ] as const)('prevents changing or removing identity fields for %s before saving', async (type, storedType) => {
        const service = new ConfigurationService();
        const configuration = {
            id: 'immutable-id',
            ...(storedType === undefined ? {} : { type: storedType }),
            name: 'Original',
        };
        const entry: ConfigurationEntry = { type, id: configuration.id, location: '', configuration };
        const update = vi.fn(async () => entry);
        service.register(type, { list: async () => [entry], update });
        const invalidPatches = [
            { oldString: '"id": "immutable-id"', newString: '"id": "changed-id"' },
            { oldString: '"id": "immutable-id",', newString: '' },
            { oldString: '"id": "immutable-id"', newString: '"id": null' },
            ...(storedType === undefined ? [
                { oldString: '"name": "Original"', newString: '"name": "Original", "type": "workflow"' },
            ] : [
                { oldString: `"type": "${storedType}"`, newString: '"type": "other"' },
                { oldString: `"type": "${storedType}",`, newString: '' },
                { oldString: `"type": "${storedType}"`, newString: '"type": null' },
            ]),
        ];
        for (const patch of invalidPatches) {
            await expect(service.edit(entry.id, [
                { oldString: '"name": "Original"', newString: '"name": "Original", "description": "Updated"' },
                patch,
            ])).rejects.toThrow('Cannot change configuration id or type.');
        }
        expect(update).not.toHaveBeenCalled();
        expect((await service.read(type))[0].configuration).toEqual(configuration);
        await service.edit(entry.id, [{ oldString: '"name": "Original"', newString: '"name": "Updated"' }]);
        expect(update).toHaveBeenCalledExactlyOnceWith(entry, { ...configuration, name: 'Updated' }, '');
    });

    it('filters JSON entries by optional type and case-insensitive regular expression', async () => {
        const { service } = setup();
        expect(await service.read()).toHaveLength(1);
        expect(await service.read('workflow')).toEqual([]);
        expect(await service.read('ssh', 'STAGING|PRODUCTION')).toHaveLength(1);
        expect(await service.read('workflow', 'Production')).toEqual([]);
        expect(await service.read(undefined, 'example\\.com')).toHaveLength(1);
        expect(await service.read(undefined, '"id":"server-\\d+"')).toHaveLength(1);
        expect(await service.read(undefined, 'server-1')).toHaveLength(1);
        expect(await service.read(undefined, '^Production$')).toEqual([]);
        expect(await service.read(undefined, '')).toHaveLength(1);
        expect(await service.read(undefined, ' Production ')).toEqual([]);
        expect(await service.read(undefined, 'missing')).toEqual([]);
    });

    it('rejects invalid regular expressions before reading providers', async () => {
        const service = new ConfigurationService();
        const list = vi.fn(async () => []);
        service.register('ssh', { list, update: vi.fn() });
        await expect(service.read(undefined, '[')).rejects.toThrow('Invalid regex');
        await expect(service.read(undefined, 123 as unknown as string)).rejects.toThrow('regex must be a string');
        expect(list).not.toHaveBeenCalled();
    });

    it('preserves fields and serializes consecutive updates', async () => {
        const { service } = setup();
        await Promise.all([
            service.edit('server-1', [{ oldString: '"name":"Production"', newString: '"name":"Updated"' }]),
            service.edit('server-1', [{ oldString: '"host":"example.com"', newString: '"host":"new.example.com"' }]),
        ]);
        expect((await service.read())[0].configuration).toEqual({
            id: 'server-1', name: 'Updated', host: 'new.example.com', aiEnabled: true,
        });
    });

    it('rejects immutable fields, invalid patches, missing IDs and cancellation', async () => {
        const { service, update } = setup();
        await expect(service.edit('server-1', [{ oldString: '"server-1"', newString: '"changed"' }])).rejects.toThrow('Cannot change');
        await expect(service.edit('server-1', [])).rejects.toThrow('non-empty array');
        await expect(service.edit('server-1', [{ oldString: '"location": ""', newString: '"location":null' }])).rejects.toThrow('location');
        await expect(service.edit('missing', [])).rejects.toThrow('not found');
        await expect(service.edit('server-1', [], () => true)).rejects.toThrow('cancelled');
        await expect(service.edit('server-1', [{ oldString: '"Production"', newString: '{' }])).rejects.toThrow();
        await expect(service.edit('server-1', [
            { oldString: '"Production"', newString: '"Updated"' },
            { oldString: 'missing', newString: 'other' },
        ])).rejects.toThrow('not found');
        expect(update).not.toHaveBeenCalled();
        await service.edit('server-1', [{ oldString: '"Production"', newString: '"Recovered"' }]);
        expect(update).toHaveBeenCalledOnce();
    });

    it('rejects ambiguous IDs', async () => {
        const { service, update } = setup();
        service.register('workflow', {
            list: async () => [{ type: 'workflow', id: 'server-1', location: '', configuration: {} }], update,
        });
        await expect(service.edit('server-1', [])).rejects.toThrow('ambiguous');
        expect(update).not.toHaveBeenCalled();
    });
});