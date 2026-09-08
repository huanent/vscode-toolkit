import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('independent connection features replace the Servers view', () => {
	assert.doesNotMatch(JSON.stringify(manifest.contributes), /vscode-toolkit\.servers\.servers/);
	for (const name of ['SSH', 'Database', 'Container']) {
		assert.ok(
			manifest.contributes.commands.some(entry => entry.command === `vscode-toolkit.open${name}`),
		);
	}
	assert.equal(
		manifest.contributes.commands.filter(command =>
			command.command.startsWith('vscode-toolkit.servers.'),
		).length,
		4,
	);
	const tools = manifest.contributes.languageModelTools;
	assert.deepEqual(
		tools.map(tool => tool.name),
		['servers_list_servers', 'servers_ssh', 'servers_sql', 'servers_container', 'servers_sftp'],
	);
	for (const tool of tools)
		assert.equal(tool.when, 'config.toolkit.servers.enableLanguageModelTools');
	assert.equal(
		Object.keys(manifest.contributes.configuration.properties).filter(key =>
			key.endsWith('storagePath'),
		).length,
		1,
	);
	assert.doesNotMatch(JSON.stringify(manifest.contributes), /serverkit/i);
	const commandIds = new Set(manifest.contributes.commands.map(command => command.command));
	for (const entries of Object.values(manifest.contributes.menus)) {
		for (const entry of entries) {
			if (entry.command?.startsWith('vscode-toolkit.servers.'))
				assert.ok(commandIds.has(entry.command));
		}
	}
});

test('Servers storage follows Toolkit default, absolute and home paths', () => {
	let configured = '';
	const vscode = {
		workspace: {
			getConfiguration: section => {
				assert.equal(section, 'toolkit');
				return { get: () => configured };
			},
		},
		Uri: { file: value => value, joinPath: (...parts) => path.join(...parts) },
	};
	const sandbox = {
		exports: {},
		require: dependency => (dependency === 'vscode' ? vscode : require(dependency)),
	};
	vm.runInNewContext(
		ts.transpileModule(read('src/storagePath.ts'), {
			compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
		}).outputText,
		sandbox,
	);
	const context = { globalStorageUri: '/toolkit-default' };
	assert.equal(sandbox.exports.getStorageUri(context, 'servers'), '/toolkit-default/servers');
	configured = '/custom';
	assert.equal(sandbox.exports.getStorageUri(context, 'servers'), '/custom/servers');
	configured = '~/toolkit';
	assert.equal(
		sandbox.exports.getStorageUri(context, 'servers'),
		path.join(os.homedir(), 'toolkit/servers'),
	);
	configured = 'relative';
	assert.throws(() => sandbox.exports.getStorageUri(context, 'servers'), /absolute path/);
});

test('all Servers webview bundles and shared styles are built', () => {
	for (const entry of [
		'serverManagement',
		'containerEditor',
		'databaseSqlResults',
		'mysqlOverview',
		'mysqlTablePreview',
		'serverForm',
		'sshTerminal',
	]) {
		assert.ok(fs.statSync(path.join(root, 'media', `${entry}.js`)).size > 0);
	}
	for (const entry of ['servers', 'sshTerminal'])
		assert.ok(fs.statSync(path.join(root, 'media', `${entry}.css`)).size > 0);
	assert.doesNotMatch(read('.vscodeignore'), /^node_modules\/\*\*$/m);
	assert.equal(typeof require('ssh2').Client, 'function');
	assert.equal(typeof require('mysql2/promise').createConnection, 'function');
});
