import { resolveConfigurationIdentity } from '../credential/configurationIdentity';
import type { CredentialSummary } from '../credential/protocol';

export type ServerType = 'container';

export interface BaseServer {
	id: string;
	type: ServerType;
	name: string;
	group: string;
	aiEnabled: boolean;
}

interface ContainerServerBase extends BaseServer {
	type: 'container';
	runtime: 'docker' | 'podman' | 'apple';
	executablePath: string;
}

export type ContainerServer = ContainerServerBase &
	(
		| { connectionType: 'local' }
		| { connectionType: 'ssh'; sshServerId: string }
		| {
			connectionType: 'ssh';
			sshServerId?: undefined;
			credentialId: string;
			host: string;
			port: number;
			proxyCommand?: string;
			proxy?: SshProxy;
		}
	);

export interface SshProxy {
	credentialId: string;
	host: string;
	port: number;
}

export type Server = ContainerServer;

export type ExportedServer = Server;

export interface ServerFormMessage {
	credentialId?: unknown;
	proxyCredentialId?: unknown;
	location?: unknown;
	type: 'save' | 'selectExecutable';
	name?: unknown;
	group?: unknown;
	host?: unknown;
	port?: unknown;
	proxyCommand?: unknown;
	proxyEnabled?: unknown;
	proxyHost?: unknown;
	proxyPort?: unknown;
	database?: unknown;
	runtime?: unknown;
	executablePath?: unknown;
	connectionType?: unknown;
	sshServerId?: unknown;
	commands?: unknown;
	aiEnabled?: unknown;
}

function parseSshProxy(message: ServerFormMessage, requireCredential: boolean): SshProxy | undefined {
	if (message.proxyEnabled !== true) {
		return undefined;
	}
	const credentialId = normalizeString(message.proxyCredentialId);
	const host = normalizeString(message.proxyHost);
	const port = Number(message.proxyPort);
	if ((requireCredential && !credentialId) || !host || !Number.isInteger(port) || port < 1 || port > 65_535) {
		return undefined;
	}
	return {
		credentialId,
		host,
		port,
	};
}

export function parseServerForm(
	message: ServerFormMessage,
	_serverType: ServerType,
	serverId?: string,
	requireCredential = true,
): Server | undefined {
	const name = normalizeString(message.name);
	const group = normalizeString(message.group);
	if (!name) {
		return undefined;
	}
	const runtime =
		message.runtime === 'podman' ? 'podman' : message.runtime === 'apple' ? 'apple' : 'docker';
	const executablePath = normalizeString(message.executablePath);
	if (!executablePath) {
		return undefined;
	}
	const baseServer = {
		id: serverId ?? crypto.randomUUID(),
		type: 'container',
		name,
		group,
		aiEnabled: message.aiEnabled === true,
		runtime,
		executablePath,
	} as const;
	if (message.proxyEnabled !== true) {
		return { ...baseServer, connectionType: 'local' };
	}
	const sshServerId = normalizeString(message.sshServerId);
	if (sshServerId) {
		return { ...baseServer, connectionType: 'ssh', sshServerId };
	}
	const proxy = parseSshProxy(message, requireCredential);
	if (!proxy) {
		return undefined;
	}
	return {
		...baseServer,
		connectionType: 'ssh',
		credentialId: proxy.credentialId,
		host: proxy.host,
		port: proxy.port,
	};
}

export function parseServerExport(value: unknown): ExportedServer[] {
	if (!isRecord(value) || !Array.isArray(value.servers)) {
		throw new Error('The file is not a supported Servers export.');
	}

	const serverIds = new Set<string>();
	return value.servers
		.filter(entry => isRecord(entry) && entry.type === 'container')
		.map((entry, index) => {
			if (!isRecord(entry)) {
				throw new Error(`Server ${index + 1} is invalid.`);
			}

			let server: Server;
			try {
				server = parseServer(entry);
			} catch {
				throw new Error(`Server ${index + 1} has invalid or missing fields.`);
			}
			if (serverIds.has(server.id)) {
				throw new Error(`Server ${index + 1} uses a duplicate ID.`);
			}

			serverIds.add(server.id);
			return server;
		});
}

export function parseServer(value: unknown, credentials?: readonly CredentialSummary[]): Server {
	if (credentials) value = resolveConfigurationIdentity(value, credentials);
	if (!isRecord(value)) {
		throw new Error('Invalid server.');
	}

	const type = value.type === 'container' ? 'container' : undefined;
	const id = normalizeString(value.id);
	if (!type || !id) {
		throw new Error('Invalid server.');
	}
	const containerSsh = type === 'container' && value.connectionType === 'ssh';
	const manualContainerSsh = containerSsh && !normalizeString(value.sshServerId);

	const server = parseServerForm(
		{
			type: 'save',
			name: value.name,
			group: value.group,
			host: value.host,
			port: value.port,
			credentialId: value.credentialId,
			proxyCommand: value.proxyCommand,
			proxyEnabled: containerSsh || isRecord(value.proxy),
			proxyCredentialId: manualContainerSsh ? value.credentialId : isRecord(value.proxy) ? value.proxy.credentialId : undefined,
			proxyHost: manualContainerSsh
				? value.host
				: isRecord(value.proxy)
					? value.proxy.host
					: undefined,
			proxyPort: manualContainerSsh
				? value.port
				: isRecord(value.proxy)
					? value.proxy.port
					: undefined,
			database: value.database,
			runtime: value.runtime,
			executablePath: value.executablePath,
			connectionType: value.connectionType,
			sshServerId: value.sshServerId,
			commands: value.commands,
			aiEnabled: value.aiEnabled === true,
		},
		type,
		id,
		false,
	);
	if (!server) {
		throw new Error('Invalid server.');
	}
	return server;
}

function normalizeString(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
