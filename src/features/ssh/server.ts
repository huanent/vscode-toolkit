import { resolveConfigurationIdentity } from '../credential/configurationIdentity';
import type { CredentialSummary } from '../credential/protocol';

export type ServerType = 'ssh';

export interface BaseServer {
	id: string;
	type: ServerType;
	name: string;
	group: string;
	aiEnabled: boolean;
}

export interface NetworkServer extends BaseServer {
	host: string;
	port: number;
}

export interface SshProxy {
	credentialId: string;
	host: string;
	port: number;
}

export interface ServerCommand {
	name: string;
	value: string;
}

export interface SshServer extends NetworkServer {
	credentialId?: string;
	type: 'ssh';
	proxyCommand?: string;
	proxy?: SshProxy;
	commands: ServerCommand[];
	favorites?: string[];
}

export type Server = SshServer;

export type ExportedServer = Server;

export interface ServerFormMessage {
	proxyCredentialId?: unknown;
	credentialId?: unknown;
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
	favorites?: unknown;
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
	const credentialId = normalizeString(message.credentialId);
	const host = normalizeString(message.host);
	const port = Number(message.port);
	if ((requireCredential && !credentialId) || !name || !host || !Number.isInteger(port) || port < 1 || port > 65_535) {
		return undefined;
	}

	const baseServer = {
		credentialId,
		id: serverId ?? crypto.randomUUID(),
		name,
		group,
		aiEnabled: message.aiEnabled === true,
		host,
		port,
	};

	const proxy = parseSshProxy(message, requireCredential);
	if (message.proxyEnabled === true && !proxy) {
		return undefined;
	}
	return {
		...baseServer,
		...(normalizeString(message.credentialId) ? { credentialId: normalizeString(message.credentialId) } : {}),
		type: 'ssh',
		...(!proxy && normalizeString(message.proxyCommand)
			? { proxyCommand: normalizeString(message.proxyCommand) }
			: {}),
		...(proxy ? { proxy } : {}),
		commands: normalizeCommands(message.commands),
		favorites: Array.isArray(message.favorites)
			? [...new Set(message.favorites.filter((path): path is string => typeof path === 'string' && path.trim().length > 0))]
			: undefined,
	};
}

export function parseServerExport(value: unknown): ExportedServer[] {
	if (!isRecord(value) || !Array.isArray(value.servers)) {
		throw new Error('The file is not a supported Servers export.');
	}

	const serverIds = new Set<string>();
	return value.servers
		.filter(entry => isRecord(entry) && entry.type === 'ssh')
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

	const type = value.type === 'ssh' ? 'ssh' : undefined;
	const id = normalizeString(value.id);
	if (!type || !id) {
		throw new Error('Invalid server.');
	}
	const containerSsh = false;
	const manualContainerSsh = containerSsh && !normalizeString(value.sshServerId);

	const server = parseServerForm(
		{
			type: 'save',
			name: value.name,
			favorites: value.favorites,
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

function normalizeCommands(value: unknown): ServerCommand[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.flatMap(command => {
		if (!isRecord(command)) {
			return [];
		}
		const name = normalizeString(command.name);
		const commandValue = normalizeString(command.value);
		return name && commandValue ? [{ name, value: commandValue }] : [];
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
