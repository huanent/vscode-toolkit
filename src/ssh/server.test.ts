import { describe, expect, it } from 'vitest';
import { parseServer, parseServerExport, parseServerForm } from './server';

const connection = {
    id: 'ssh-test',
    type: 'ssh',
    name: 'Test',
    host: 'localhost',
    port: 22,
    username: 'test',
    authType: 'password',
};

describe('SSH favorites configuration', () => {
    it('saves favorites from the connection form', () => {
        const server = parseServerForm({ ...connection, type: 'save', favorites: ['/home', '/var/log'] }, 'ssh', connection.id);
        expect(server?.favorites).toEqual(['/home', '/var/log']);
        expect(server).not.toHaveProperty('sftpFavorites');
    });

    it('preserves favorites through JSON and export parsing', () => {
        const server = parseServer({ ...connection, favorites: ['/home', '/folder with spaces'] });
        expect(parseServer(JSON.parse(JSON.stringify(server))).favorites).toEqual(server.favorites);
        expect(parseServerExport({ servers: [{ ...server, password: '' }] })[0].favorites).toEqual(server.favorites);
    });

    it('removes duplicates and invalid entries without changing valid paths', () => {
        expect(parseServer({ ...connection, favorites: ['/home', '', null, 42, '  ', '/home', '/space '] }).favorites)
            .toEqual(['/home', '/space ']);
    });

    it('distinguishes legacy configurations from explicitly cleared favorites', () => {
        expect(parseServer(connection).favorites).toBeUndefined();
        expect(parseServer({ ...connection, favorites: [] }).favorites).toEqual([]);
    });
});