import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function migrateServers(root) {
	const folders = { ssh: 'ssh', mysql: 'database', container: 'container' };
	const source = path.join(root, 'servers');
	const entries = await readdir(path.join(source, 'connections'), { withFileTypes: true });
	const records = [];
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'order.json') continue;
		const filename = path.join(source, 'connections', entry.name);
		const record = JSON.parse(await readFile(filename, 'utf8'));
		if (
			!Object.hasOwn(folders, record.type) ||
			typeof record.id !== 'string' ||
			entry.name !== `${encodeURIComponent(record.id)}.json`
		) {
			throw new Error(`Invalid connection file: ${entry.name}`);
		}
		records.push({ record, filename, name: entry.name });
	}
	let order = [];
	try {
		const stored = JSON.parse(await readFile(path.join(source, 'order.json'), 'utf8'));
		if (
			stored.version !== 1 ||
			!Array.isArray(stored.serverIds) ||
			!stored.serverIds.every(id => typeof id === 'string')
		)
			throw new Error('Invalid order.json');
		order = stored.serverIds;
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
	}
	for (const folder of Object.values(folders)) {
		try {
			await stat(path.join(root, folder));
			throw new Error(`Destination already exists: ${folder}. Move it aside before migrating.`);
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
		}
	}
	for (const [type, folder] of Object.entries(folders)) {
		const destination = path.join(root, folder);
		await mkdir(path.join(destination, 'connections'), { recursive: true, mode: 0o700 });
		const selected = records.filter(({ record }) => record.type === type);
		for (const item of selected)
			await copyFile(
				item.filename,
				path.join(destination, 'connections', item.name),
				constants.COPYFILE_EXCL,
			);
		const ids = selected.map(({ record }) => record.id);
		await writeFile(
			path.join(destination, 'order.json'),
			JSON.stringify(
				{ version: 1, serverIds: [...new Set([...order.filter(id => ids.includes(id)), ...ids])] },
				null,
				2,
			),
			{ flag: 'wx', mode: 0o600 },
		);
	}
	return records.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	if (process.argv.length !== 3) {
		console.error('Usage: node scripts/migrate-servers.mjs <toolkit-data-directory>');
		process.exitCode = 1;
	} else {
		try {
			console.log(
				`Migrated ${await migrateServers(path.resolve(process.argv[2]))} connections. Original files were preserved.`,
			);
		} catch (error) {
			console.error(error.message);
			process.exitCode = 1;
		}
	}
}
