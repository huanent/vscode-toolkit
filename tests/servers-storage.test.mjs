import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);

test('feature stores isolate files, credentials, groups and deletion without reading legacy storage', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'toolkit-stores-'));
	const uri = fsPath => ({ fsPath });
	const reads = [];
	const vscode = {
		EventEmitter: class {
			listeners = new Set();
			event = callback => {
				this.listeners.add(callback);
				return { dispose: () => this.listeners.delete(callback) };
			};
			fire() {
				this.listeners.forEach(callback => callback());
			}
			dispose() {
				this.listeners.clear();
			}
		},
		Uri: { joinPath: (base, ...parts) => uri(path.join(base.fsPath, ...parts)) },
		FileType: { File: 1, Directory: 2 },
		workspace: {
			fs: {
				createDirectory: location => fs.mkdir(location.fsPath, { recursive: true }),
				readDirectory: async location => {
					reads.push(location.fsPath);
					return (await fs.readdir(location.fsPath, { withFileTypes: true })).map(entry => [
						entry.name,
						entry.isFile() ? 1 : 2,
					]);
				},
				readFile: location => fs.readFile(location.fsPath),
				writeFile: (location, content) => fs.writeFile(location.fsPath, content),
				rename: (source, target) => fs.rename(source.fsPath, target.fsPath),
				delete: location => fs.unlink(location.fsPath),
			},
		},
	};
	const sandbox = {
		exports: {},
		Buffer,
		crypto: globalThis.crypto,
		process,
		setTimeout,
		clearTimeout,
		require: dependency =>
			dependency === 'vscode'
				? vscode
				: dependency === '../../../storagePath'
					? { getStorageUri: (_context, folder) => uri(path.join(root, folder)) }
					: dependency === './server'
						? {
								parseServer: value => value,
								usesPrivateKey: server => server.authType === 'privateKey',
							}
						: dependency === 'node:fs'
							? { watch: () => ({ close() {} }) }
							: require(dependency),
	};
	const source = readFileSync(
		new URL('../src/features/servers/servers/serverStore.ts', import.meta.url),
		'utf8',
	);
	vm.runInNewContext(
		ts.transpileModule(source, {
			compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
		}).outputText,
		sandbox,
	);
	const stores = [];
	try {
		const { ServerStore } = sandbox.exports;
		const ssh = await ServerStore.create({}, 'ssh');
		const database = await ServerStore.create({}, 'mysql');
		const container = await ServerStore.create({}, 'container');
		stores.push(ssh, database, container);
		await ssh.saveServer({ id: 'ssh-1', type: 'ssh', group: 'remote' }, { password: 'ssh-secret' });
		await database.saveServer(
			{ id: 'db-1', type: 'mysql', group: 'data' },
			{ password: 'db-secret' },
		);
		await container.saveServer({
			id: 'container-1',
			type: 'container',
			group: 'runtime',
			connectionType: 'ssh',
			sshServerId: 'ssh-1',
		});
		assert.equal(ssh.getGroups().join(','), 'remote');
		assert.equal(database.getGroups().join(','), 'data');
		assert.equal(await database.getPassword('ssh-1'), undefined);
		await assert.rejects(ssh.saveServer({ id: 'wrong', type: 'mysql' }), /type does not match/);
		await assert.rejects(
			ssh.importServers([{ id: 'wrong', type: 'container' }]),
			/type does not match/,
		);
		await ssh.deleteServer('ssh-1');
		assert.equal(database.getServers().length, 1);
		assert.equal(container.getServers()[0].sshServerId, 'ssh-1');
		const reopened = await ServerStore.create({}, 'mysql');
		stores.push(reopened);
		assert.equal(await reopened.getPassword('db-1'), 'db-secret');
		assert.equal((await fs.readdir(path.join(root, 'ssh', 'connections'))).length, 0);
		assert.equal(
			reads.some(location => location.startsWith(path.join(root, 'servers'))),
			false,
		);
	} finally {
		stores.forEach(store => store.dispose());
		await fs.rm(root, { recursive: true, force: true });
	}
});
