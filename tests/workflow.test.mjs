import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(
	new URL('../src/features/workflow/workflow.ts', import.meta.url),
	'utf8',
);
const compiled = ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const loaded = { exports: {} };
new Function('exports', 'module', compiled.outputText)(loaded.exports, loaded);
const { executeWorkflow, parseWorkflow } = loaded.exports;
const workflow = { steps: [{ type: 'command' }, { type: 'ssh' }, { type: 'sftp' }] };

test('validates incoming workflow drafts and strips unknown fields', () => {
	const valid = {
		id: 'one',
		name: 'Deploy',
		steps: [
			{ name: 'Build', type: 'command', command: 'npm run build', cwd: '/tmp' },
			{
				name: 'Upload',
				type: 'sftp',
				serverId: 'host',
				localPath: '/tmp/file',
				remotePath: '/srv/file',
			},
			{ name: 'Restart', type: 'ssh', serverId: 'host', command: 'restart' },
		],
	};
	assert.deepEqual(parseWorkflow({ ...valid, password: 'ignored' }), valid);
	for (const invalid of [
		null,
		{},
		{ ...valid, steps: [{}] },
		{ ...valid, steps: [{ name: 'bad', type: 'other' }] },
		{ ...valid, steps: [{ ...valid.steps[0], command: '' }] },
	]) {
		assert.throws(() => parseWorkflow(invalid));
	}
});

test('executes all step types sequentially', async () => {
	const seen = [];
	await executeWorkflow(
		workflow,
		async step => {
			seen.push(step.type);
		},
		() => false,
	);
	assert.deepEqual(seen, ['command', 'ssh', 'sftp']);
});

test('stops on failure', async () => {
	const seen = [];
	await assert.rejects(
		executeWorkflow(
			workflow,
			async step => {
				seen.push(step.type);
				throw new Error('failed');
			},
			() => false,
		),
		/failed/,
	);
	assert.deepEqual(seen, ['command']);
});

test('cancellation prevents the next step', async () => {
	let cancelled = false;
	let count = 0;
	await assert.rejects(
		executeWorkflow(
			workflow,
			async () => {
				count++;
				cancelled = true;
			},
			() => cancelled,
		),
		/cancelled/,
	);
	assert.equal(count, 1);
});

test('rejects empty workflows', async () => {
	await assert.rejects(
		executeWorkflow(
			{ steps: [] },
			async () => {},
			() => false,
		),
		/at least one/,
	);
});
