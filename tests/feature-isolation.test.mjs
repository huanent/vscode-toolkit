import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const domains = ['ssh', 'database', 'container'];
const read = filename => readFileSync(path.join(root, filename), 'utf8');

function loadModel(domain) {
	const source = read(`src/features/${domain}/server.ts`);
	const output = ts.transpileModule(source, {
		compilerOptions: { module: ts.ModuleKind.CommonJS },
	}).outputText;
	const module = { exports: {} };
	new Function('exports', 'require', 'module', output)(module.exports, require, module);
	return module.exports;
}

const samples = {
	ssh: {
		id: 'ssh-one',
		type: 'ssh',
		name: 'SSH',
		group: '',
		host: 'localhost',
		port: 22,
		username: 'user',
		authType: 'password',
		commands: [],
	},
	database: {
		id: 'db-one',
		type: 'mysql',
		name: 'Database',
		group: '',
		host: 'localhost',
		port: 3306,
		username: 'user',
		database: 'test',
	},
	container: {
		id: 'container-one',
		type: 'container',
		name: 'Container',
		group: '',
		runtime: 'docker',
		executablePath: 'docker',
		connectionType: 'local',
	},
};

for (const domain of domains) {
	test(`${domain} parses its own connections and rejects other domains`, () => {
		const model = loadModel(domain);
		assert.equal(model.parseServer(samples[domain]).type, samples[domain].type);
		for (const other of domains.filter(candidate => candidate !== domain)) {
			assert.throws(() => model.parseServer(samples[other]));
		}
		const exported = model.parseServerExport({
			servers: [{ ...samples[domain], password: 'secret' }],
		});
		assert.equal(exported[0].id, samples[domain].id);
		assert.equal(exported[0].password, 'secret');
		assert.equal(
			model.parseServerExport({
				servers: Object.values(samples).map(server => ({ ...server, password: 'secret' })),
			}).length,
			1,
		);
		assert.equal(
			model.parseServerForm({ type: 'save', name: '' }, samples[domain].type),
			undefined,
		);
	});
}

test('container supports local, saved SSH and manual SSH connections', () => {
	const model = loadModel('container');
	assert.equal(
		model.parseServer({ ...samples.container, connectionType: 'ssh', sshServerId: 'ssh-one' })
			.sshServerId,
		'ssh-one',
	);
	const manual = model.parseServer({
		...samples.container,
		connectionType: 'ssh',
		host: 'localhost',
		port: 22,
		username: 'user',
		authType: 'privateKey',
	});
	assert.equal(model.usesPrivateKey(manual), true);
});

test('features have independent editor and tool contributions', () => {
	const manifest = JSON.parse(read('package.json'));
	for (const domain of domains) {
		const editor = manifest.contributes.customEditors.find(
			candidate => candidate.viewType === `vscode-toolkit.${domain}.editor`,
		);
		assert.equal(editor.selector[0].filenamePattern, `*.${domain}`);
		assert.ok(
			manifest.contributes.languageModelTools.some(
				tool => tool.name === `${domain}_list_connections`,
			),
		);
		assert.ok(
			manifest.contributes.configuration.properties[`toolkit.${domain}.enableLanguageModelTools`],
		);
	}
	assert.ok(
		!manifest.contributes.customEditors.some(
			editor => editor.viewType === 'vscode-toolkit.servers.editor',
		),
	);
});

test('no shared servers directory or form protocol remains', () => {
	assert.equal(existsSync(path.join(root, 'src/features/servers')), false);
	assert.equal(existsSync(path.join(root, 'shared/protocol/connections')), false);
	function inspect(directory) {
		for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
			const filename = `${directory}/${entry.name}`;
			if (entry.isDirectory()) inspect(filename);
			else if (/\.[cm]?[jt]sx?$/.test(filename)) {
				const source = ts.createSourceFile(filename, read(filename), ts.ScriptTarget.Latest, true);
				for (const statement of source.statements) {
					if (ts.isImportDeclaration(statement))
						assert.doesNotMatch(
							statement.moduleSpecifier.text,
							/(?:features\/servers|\.\.\/servers|protocol\/connections)/,
						);
				}
			}
		}
	}
	inspect('src');
	inspect('webview/src');
});

test('SSH dot directories retain their runtime meaning', () => {
	assert.match(read('src/features/ssh/sshTerminal.ts'), /private sftpPath = '\.'/);
	assert.match(
		read('src/features/ssh/sftp.ts'),
		/entry.filename !== '\.' && entry.filename !== '\.\.'/,
	);
});
