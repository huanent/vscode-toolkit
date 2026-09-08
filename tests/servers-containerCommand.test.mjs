import assert from 'node:assert/strict';
import test from 'node:test';
import loadTypescript from './helpers/loadTypescript.cjs';

function setup({ stdout = ' result \n', error, sshError } = {}) {
	const calls = [];
	const { executeContainerCommand } = loadTypescript(
		'src/features/servers/containers/containerCommand.ts',
		{
			'node:child_process': {
				execFile: (executable, args, options, callback) => {
					calls.push({ executable, args, options });
					callback(error, { stdout });
				},
			},
			'../ssh/sshCommand': {
				executeSshCommand: async (server, credentials, command) => {
					calls.push({ server, credentials, command });
					if (sshError) throw sshError;
					return stdout;
				},
			},
		},
	);
	return { executeContainerCommand, calls };
}

const local = {
	id: 'container',
	runtime: 'docker',
	connectionType: 'local',
	executablePath: '/path with spaces/docker',
};
const ssh = { id: 'ssh', type: 'ssh', host: 'example.invalid' };
const credentials = { password: 'test-only' };
const store = { getServers: () => [ssh], getCredentials: async () => credentials };

test('local execution preserves argument boundaries and trims stdout', async () => {
	const { executeContainerCommand, calls } = setup();
	const args = ['inspect', 'name with spaces', "quote'", '$(printf unexpected)'];
	assert.equal(await executeContainerCommand(local, store, args), 'result');
	assert.equal(calls[0].executable, local.executablePath);
	assert.equal(calls[0].args, args);
	assert.equal(calls[0].options.maxBuffer, 20 * 1024 * 1024);
});

test('local failures use stderr or fall back to the error message', async () => {
	for (const stderr of [' daemon unavailable \n', '']) {
		const { executeContainerCommand } = setup({
			error: Object.assign(new Error('spawn failed'), { stderr }),
		});
		await assert.rejects(executeContainerCommand(local, store, []), {
			message: `docker command failed: ${stderr.trim() || 'spawn failed'}`,
		});
	}
});

test('linked SSH execution resolves credentials and quotes every argument', async () => {
	const { executeContainerCommand, calls } = setup();
	await executeContainerCommand({ ...local, connectionType: 'ssh', sshServerId: 'ssh' }, store, [
		'inspect',
		"it's here",
		'',
	]);
	assert.equal(calls[0].server, ssh);
	assert.equal(calls[0].credentials, credentials);
	assert.equal(calls[0].command, "'/path with spaces/docker' 'inspect' 'it'\"'\"'s here' ''");
});

test('missing linked SSH servers fail before command execution', async () => {
	const { executeContainerCommand, calls } = setup();
	await assert.rejects(
		executeContainerCommand({ ...local, connectionType: 'ssh', sshServerId: 'missing' }, store, []),
		/no longer exists/,
	);
	assert.equal(calls.length, 0);
});

test('manual SSH configuration retains proxy settings and credential identity', async () => {
	const { executeContainerCommand, calls } = setup();
	const server = {
		...local,
		connectionType: 'ssh',
		authType: 'password',
		host: 'example.invalid',
		port: 22,
		username: 'tester',
		proxyCommand: 'proxy command',
	};
	let credentialId;
	await executeContainerCommand(
		server,
		{
			getCredentials: async id => {
				credentialId = id;
				return credentials;
			},
		},
		['info'],
	);
	assert.equal(credentialId, local.id);
	assert.equal(calls[0].server.host, server.host);
	assert.equal(calls[0].server.proxyCommand, server.proxyCommand);
	assert.equal(calls[0].server.type, 'ssh');
});

test('SSH command errors include the container runtime', async () => {
	const { executeContainerCommand } = setup({ sshError: new Error('connection lost') });
	await assert.rejects(
		executeContainerCommand({ ...local, connectionType: 'ssh', sshServerId: 'ssh' }, store, []),
		/docker command failed: connection lost/,
	);
});
