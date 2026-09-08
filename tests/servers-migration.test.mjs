import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { migrateServers } from '../scripts/migrate-servers.mjs';

test('manual migration splits types, preserves credentials, order and SSH references without overwriting', async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), 'toolkit-migration-'));
	try {
		const source = path.join(root, 'servers', 'connections');
		await mkdir(source, { recursive: true });
		const records = [
			{ id: 'ssh-1', type: 'ssh', password: 'test-secret' },
			{ id: 'ssh-2', type: 'ssh', privateKey: 'test-key' },
			{ id: 'db-1', type: 'mysql', password: 'db-secret' },
			{ id: 'container-1', type: 'container', sshServerId: 'ssh-1' },
		];
		for (const record of records)
			await writeFile(path.join(source, `${record.id}.json`), JSON.stringify(record));
		await writeFile(
			path.join(root, 'servers', 'order.json'),
			JSON.stringify({ version: 1, serverIds: ['ssh-2', 'db-1', 'ssh-1', 'container-1'] }),
		);
		assert.equal(await migrateServers(root), 4);
		for (const record of records) {
			const folder = record.type === 'mysql' ? 'database' : record.type;
			assert.deepEqual(
				JSON.parse(
					await readFile(path.join(root, folder, 'connections', `${record.id}.json`), 'utf8'),
				),
				record,
			);
			assert.deepEqual(
				JSON.parse(await readFile(path.join(source, `${record.id}.json`), 'utf8')),
				record,
			);
		}
		assert.deepEqual(
			JSON.parse(await readFile(path.join(root, 'ssh', 'order.json'), 'utf8')).serverIds,
			['ssh-2', 'ssh-1'],
		);
		await assert.rejects(migrateServers(root), /Destination already exists/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
