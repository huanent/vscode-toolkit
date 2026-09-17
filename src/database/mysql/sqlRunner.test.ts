import type { Connection } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { executeSql } from './sqlRunner';

function connection() {
    return { query: vi.fn().mockResolvedValue([[], []]), destroy: vi.fn(), end: vi.fn().mockResolvedValue(undefined) };
}

describe('SQL runner', () => {
    it('runs statements in order and closes its connection', async () => {
        const client = connection();
        await executeSql(async () => client as unknown as Connection, 'SELECT 1; SELECT 2;', new AbortController().signal);
        expect(client.query.mock.calls).toEqual([['SELECT 1'], ['SELECT 2']]);
        expect(client.end).toHaveBeenCalledOnce();
    });

    it('destroys an active connection and skips subsequent statements', async () => {
        const client = connection();
        const controller = new AbortController();
        client.query.mockImplementation(async () => { controller.abort(); return [[], []]; });
        await expect(executeSql(async () => client as unknown as Connection, 'SELECT 1; SELECT 2', controller.signal)).rejects.toThrow();
        expect(client.query).toHaveBeenCalledOnce();
        expect(client.destroy).toHaveBeenCalledOnce();
        expect(client.end).not.toHaveBeenCalled();
    });

    it('destroys a connection established after cancellation', async () => {
        const client = connection();
        const controller = new AbortController();
        await expect(executeSql(async () => {
            controller.abort();
            return client as unknown as Connection;
        }, 'SELECT 1', controller.signal)).rejects.toThrow();
        expect(client.destroy).toHaveBeenCalledOnce();
        expect(client.query).not.toHaveBeenCalled();
    });
});