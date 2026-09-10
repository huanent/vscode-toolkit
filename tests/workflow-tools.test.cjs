const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');

function load(file, dependencies = {}) {
	const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
	}).outputText;
	const loaded = { exports: {} };
	new Function('require', 'module', 'exports', compiled)(
		name => dependencies[name] ?? require(name),
		loaded,
		loaded.exports,
	);
	return loaded.exports;
}

test('workflow descriptions, summary isolation and detail retrieval', async () => {
	const model = load('src/features/workflow/workflow.ts');
	const legacy = {
		id: 'legacy',
		name: 'Build',
		steps: [{ name: 'Build', type: 'command', command: 'npm run build', cwd: '/tmp' }],
	};
	assert.equal(model.parseWorkflow(legacy).description, '');
	assert.equal(Object.hasOwn(model.parseWorkflow(legacy).steps[0], 'description'), false);
	assert.throws(() => model.parseWorkflow({ ...legacy, description: 42 }), /description/);
	assert.deepEqual(
		model.parseWorkflow({
			...legacy,
			steps: [{ ...legacy.steps[0], description: 'Old description' }],
		}).steps,
		legacy.steps,
	);
	const tools = new Map();
	let saved = [legacy];
	const vscode = {
		Disposable: { from: (...items) => items },
		LanguageModelTextPart: class {
			constructor(value) {
				this.value = value;
			}
		},
		LanguageModelToolResult: class {
			constructor(content) {
				this.content = content;
			}
		},
		workspace: {
			getConfiguration: () => {
				throw new Error('Tool registration must not depend on removed configuration.');
			},
		},
		lm: {
			registerTool: (name, tool) => {
				tools.set(name, tool);
				return {};
			},
		},
	};
	load('src/features/workflow/tools.ts', {
		vscode,
		'./workflow': model,
		'../ssh/connectionService': { listSshConnections: () => [{ id: 'ssh', aiEnabled: true }] },
	}).registerWorkflowTools(
		{
			globalState: {
				get: () => saved,
				update: async (_key, value) => {
					saved = value;
				},
			},
		},
		async () => true,
	);
	const invoke = async (name, input = {}) =>
		JSON.parse(
			(await tools.get(name).invoke({ input }, { isCancellationRequested: false })).content[0]
				.value,
		);
	assert.deepEqual(await invoke('listWorkflows'), [
		{ id: 'legacy', name: 'Build', description: '', stepCount: 1 },
	]);
	assert.equal((await invoke('getWorkflow', { id: 'legacy' })).steps[0].command, 'npm run build');
	await assert.rejects(invoke('getWorkflow', { id: 'missing' }), /not found/);
	const workflow = {
		...legacy,
		description: 'Release build',
		steps: [
			{ ...legacy.steps[0] },
			{ name: 'Remote', type: 'ssh', serverId: 'ssh', command: 'pwd' },
			{
				name: 'Upload',
				type: 'sftp',
				serverId: 'ssh',
				localPath: '/tmp/build',
				remotePath: '/tmp/build',
			},
		],
	};
	await invoke('upsertWorkflow', {
		...workflow,
		steps: workflow.steps.map(step => ({ ...step, description: 'Deprecated' })),
	});
	assert.deepEqual(saved[0], workflow);
	await assert.rejects(
		invoke('upsertWorkflow', {
			...workflow,
			steps: [{ name: 'Remote', type: 'ssh', serverId: 'disabled', command: 'pwd' }],
		}),
		/not enabled for AI/,
	);
	assert.deepEqual(await invoke('getWorkflow', { id: 'legacy' }), workflow);
	assert.deepEqual(await invoke('listWorkflows'), [
		{ id: 'legacy', name: 'Build', description: 'Release build', stepCount: 3 },
	]);
	const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
	for (const feature of ['ssh', 'database', 'container', 'workflow'])
		assert.equal(
			Object.hasOwn(
				manifest.contributes.configuration.properties,
				`toolkit.${feature}.enableLanguageModelTools`,
			),
			false,
		);
	for (const tool of manifest.contributes.languageModelTools)
		assert.equal(Object.hasOwn(tool, 'when'), false);
	for (const name of tools.keys())
		assert.equal(
			manifest.contributes.languageModelTools.find(tool => tool.name === name).toolReferenceName,
			name,
		);
	const schema = manifest.contributes.languageModelTools.find(
		tool => tool.name === 'upsertWorkflow',
	).inputSchema;
	assert.equal(schema.properties.description.type, 'string');
	for (const step of schema.properties.steps.items.oneOf)
		assert.equal(Object.hasOwn(step.properties, 'description'), false);
});
