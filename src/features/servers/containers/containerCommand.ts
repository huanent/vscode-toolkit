import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ContainerServer, SshServer } from '../servers/server';
import type { ServerStore } from '../servers/serverStore';
import { executeSshCommand } from '../ssh/sshCommand';

const execFileAsync = promisify(execFile);

export async function executeContainerCommand(
	server: ContainerServer,
	serverStore: ServerStore,
	args: string[],
): Promise<string> {
	if (server.connectionType === 'ssh') {
		const { sshServer, credentials } = await resolveSshConnection(server, serverStore);
		const command = [server.executablePath, ...args].map(shellQuote).join(' ');
		try {
			return await executeSshCommand(sshServer, credentials, command);
		} catch (error) {
			throw new Error(`${server.runtime} command failed: ${errorMessage(error)}`);
		}
	}
	try {
		const { stdout } = await execFileAsync(server.executablePath, args, {
			encoding: 'utf8',
			maxBuffer: 20 * 1024 * 1024,
		});
		return stdout.trim();
	} catch (error) {
		if (isExecError(error)) {
			const detail = error.stderr?.trim() || error.message;
			throw new Error(`${server.runtime} command failed: ${detail}`);
		}
		throw error;
	}
}

async function resolveSshConnection(server: ContainerServer, serverStore: ServerStore) {
	if (server.connectionType !== 'ssh') {
		throw new Error('The container server is not configured for SSH.');
	}
	if (server.sshServerId) {
		const sshServer = serverStore
			.getServers()
			.find(
				(candidate): candidate is SshServer =>
					candidate.type === 'ssh' && candidate.id === server.sshServerId,
			);
		if (!sshServer) {
			throw new Error('The selected SSH server no longer exists.');
		}
		return { sshServer, credentials: await serverStore.getCredentials(sshServer.id) };
	}
	if (!('authType' in server)) {
		throw new Error('The manual SSH configuration is invalid.');
	}
	const sshServer: SshServer = {
		id: server.id,
		type: 'ssh',
		name: server.name,
		group: server.group,
		aiEnabled: server.aiEnabled,
		host: server.host,
		port: server.port,
		username: server.username,
		authType: server.authType,
		commands: [],
		...(server.proxyCommand ? { proxyCommand: server.proxyCommand } : {}),
		...(server.proxy ? { proxy: server.proxy } : {}),
	};
	return { sshServer, credentials: await serverStore.getCredentials(server.id) };
}

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function isExecError(error: unknown): error is Error & { stderr?: string } {
	return error instanceof Error;
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
