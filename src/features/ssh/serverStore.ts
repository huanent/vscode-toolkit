import { watch, FSWatcher } from 'node:fs';
import * as vscode from 'vscode';
import { getStorageUri } from '../../storagePath';
import { ExportedServer, parseServer, Server, ServerType, usesPrivateKey } from './server';

const serverOrderFileName = 'order.json';
const serverOrderVersion = 1;

export interface ServerCredentials {
	password?: string;
	privateKey?: string;
	passphrase?: string;
	proxyPassword?: string;
	proxyPrivateKey?: string;
	proxyPassphrase?: string;
}

export type ServerMoveDirection = 'up' | 'down';

class ConnectionStore {
	private readonly changeEmitter = new vscode.EventEmitter<void>();
	readonly onDidChange = this.changeEmitter.event;
	private readonly storageDirectoryUri: vscode.Uri;
	private readonly serversDirectoryUri: vscode.Uri;
	private servers: Server[] = [];
	private readonly credentials = new Map<string, ServerCredentials>();
	private watcher: FSWatcher | undefined;
	private reloadTimer: NodeJS.Timeout | undefined;
	private mutationQueue: Promise<void> = Promise.resolve();
	private writeInProgress = false;

	private constructor(
		context: vscode.ExtensionContext,
		private readonly serverType: ServerType = 'ssh',
	) {
		this.storageDirectoryUri = getStorageUri(context, 'ssh');
		this.serversDirectoryUri = vscode.Uri.joinPath(this.storageDirectoryUri, 'connections');
	}

	static async create(
		context: vscode.ExtensionContext,
		serverType: ServerType = 'ssh',
	): Promise<ConnectionStore> {
		const store = new ConnectionStore(context, serverType);
		try {
			await store.initialize();
			return store;
		} catch (error) {
			store.dispose();
			throw error;
		}
	}

	getServers(): Server[] {
		return this.servers;
	}

	getGroups(): string[] {
		return [
			...new Set(
				this.getServers()
					.map(server => server.group)
					.filter(Boolean),
			),
		].sort((left, right) => left.localeCompare(right));
	}

	async saveServer(server: Server, credentials: ServerCredentials = {}): Promise<void> {
		this.assertServerType(server);
		await this.enqueueMutation(async () => {
			const servers = this.getServers();
			const exists = servers.some(current => current.id === server.id);
			const updatedServers = exists
				? servers.map(current => (current.id === server.id ? server : current))
				: [...servers, server];
			this.saveCredentials(server, credentials, false);
			await this.writeServers(updatedServers);
		});
	}

	async renameGroup(group: string, newGroup: string): Promise<void> {
		await this.enqueueMutation(() =>
			this.writeServers(
				this.getServers().map(server =>
					server.group === group ? { ...server, group: newGroup } : server,
				),
			),
		);
	}

	async moveServer(serverId: string, direction: ServerMoveDirection): Promise<void> {
		await this.enqueueMutation(async () => {
			const servers = [...this.getServers()];
			const serverIndex = servers.findIndex(server => server.id === serverId);
			if (serverIndex < 0) {
				return;
			}

			const step = direction === 'up' ? -1 : 1;
			let targetIndex = serverIndex + step;
			while (
				targetIndex >= 0 &&
				targetIndex < servers.length &&
				servers[targetIndex].group !== servers[serverIndex].group
			) {
				targetIndex += step;
			}
			if (targetIndex < 0 || targetIndex >= servers.length) {
				return;
			}

			[servers[serverIndex], servers[targetIndex]] = [servers[targetIndex], servers[serverIndex]];
			await this.writeServers(servers);
		});
	}

	async moveGroup(group: string, direction: ServerMoveDirection): Promise<void> {
		await this.enqueueMutation(async () => {
			const servers = this.getServers();
			const groups = [...new Set(servers.map(server => server.group).filter(Boolean))];
			const groupIndex = groups.indexOf(group);
			const targetIndex = groupIndex + (direction === 'up' ? -1 : 1);
			if (groupIndex < 0 || targetIndex < 0 || targetIndex >= groups.length) {
				return;
			}

			[groups[groupIndex], groups[targetIndex]] = [groups[targetIndex], groups[groupIndex]];
			await this.writeServers([
				...groups.flatMap(currentGroup => servers.filter(server => server.group === currentGroup)),
				...servers.filter(server => !server.group),
			]);
		});
	}

	async deleteServer(serverId: string): Promise<void> {
		await this.deleteServers([serverId]);
	}

	async deleteServers(serverIds: string[]): Promise<void> {
		await this.enqueueMutation(async () => {
			const deletedIds = new Set(serverIds);
			serverIds.forEach(serverId => this.credentials.delete(serverId));
			await this.writeServers(this.getServers().filter(server => !deletedIds.has(server.id)));
		});
	}

	getPassword(serverId: string): Thenable<string | undefined> {
		return Promise.resolve(this.credentials.get(serverId)?.password);
	}

	async getCredentials(serverId: string): Promise<ServerCredentials> {
		return { ...this.credentials.get(serverId) };
	}

	async getExportedServers(): Promise<ExportedServer[]> {
		return Promise.all(
			this.getServers().map(async server => {
				const credentials = await this.getCredentials(server.id);
				return {
					...server,
					password: credentials.password ?? '',
					privateKey: credentials.privateKey,
					passphrase: credentials.passphrase,
					proxyPassword: credentials.proxyPassword,
					proxyPrivateKey: credentials.proxyPrivateKey,
					proxyPassphrase: credentials.proxyPassphrase,
				};
			}),
		);
	}

	async importServers(importedServers: ExportedServer[]): Promise<void> {
		importedServers.forEach(server => this.assertServerType(server));
		await this.enqueueMutation(async () => {
			const importedIds = new Set(importedServers.map(server => server.id));
			const updatedServers = [
				...this.getServers().filter(server => !importedIds.has(server.id)),
				...importedServers.map(
					({
						password: _password,
						privateKey: _privateKey,
						passphrase: _passphrase,
						proxyPassword: _proxyPassword,
						proxyPrivateKey: _proxyPrivateKey,
						proxyPassphrase: _proxyPassphrase,
						...server
					}) => server,
				),
			];
			importedServers.forEach(server => this.saveCredentials(server, server, true));
			await this.writeServers(updatedServers);
		});
	}

	private async initialize(): Promise<void> {
		await vscode.workspace.fs.createDirectory(this.storageDirectoryUri);
		await vscode.workspace.fs.createDirectory(this.serversDirectoryUri);
		this.watcher = watch(this.serversDirectoryUri.fsPath, (_eventType, fileName) => {
			if (fileName?.endsWith('.json')) {
				this.scheduleReload();
			}
		});
		await this.reloadServers();
		await this.enqueueMutation(() => this.writeServers(this.servers));
	}

	private scheduleReload(): void {
		if (this.reloadTimer) {
			clearTimeout(this.reloadTimer);
		}
		this.reloadTimer = setTimeout(() => {
			this.reloadTimer = undefined;
			if (this.writeInProgress) {
				this.scheduleReload();
				return;
			}
			void this.enqueueMutation(() => this.reloadServers()).catch(() => undefined);
		}, 50);
	}

	private async reloadServers(): Promise<void> {
		const entries = await vscode.workspace.fs.readDirectory(this.serversDirectoryUri);
		const serverFiles = entries
			.filter(
				([name, type]) =>
					type === vscode.FileType.File && name.endsWith('.json') && name !== serverOrderFileName,
			)
			.map(([name]) => name)
			.sort();
		const storedServers = (
			await Promise.all(
				serverFiles.map(async name => {
					try {
						const content = await vscode.workspace.fs.readFile(
							vscode.Uri.joinPath(this.serversDirectoryUri, name),
						);
						const storedServer = parseStoredServer(
							JSON.parse(Buffer.from(content).toString('utf8')),
						);
						return storedServer &&
							(!this.serverType || storedServer.server.type === this.serverType) &&
							name === serverFileName(storedServer.server)
							? storedServer
							: undefined;
					} catch {
						return undefined;
					}
				}),
			)
		).filter((storedServer): storedServer is StoredServer => storedServer !== undefined);
		const storedServersById = new Map(
			storedServers.map(storedServer => [storedServer.server.id, storedServer]),
		);
		const serverOrder = await this.readServerOrder();
		const orderedIds = [
			...serverOrder.filter(serverId => storedServersById.has(serverId)),
			...[...storedServersById.keys()].filter(serverId => !serverOrder.includes(serverId)),
		];
		const orderedStoredServers = orderedIds.map(serverId => storedServersById.get(serverId)!);
		const servers = orderedStoredServers.map(({ server }) => server);
		const credentials = new Map(
			orderedStoredServers.map(
				storedServer => [storedServer.server.id, storedServer.credentials] as const,
			),
		);
		if (
			JSON.stringify(servers) === JSON.stringify(this.servers) &&
			JSON.stringify([...credentials]) === JSON.stringify([...this.credentials])
		) {
			return;
		}
		this.servers = servers;
		this.credentials.clear();
		credentials.forEach((value, key) => this.credentials.set(key, value));
		this.changeEmitter.fire();
	}

	private async writeServers(servers: Server[]): Promise<void> {
		servers.forEach(server => this.assertServerType(server));
		this.writeInProgress = true;
		try {
			const existingEntries = await vscode.workspace.fs.readDirectory(this.serversDirectoryUri);
			const expectedFiles = new Set(servers.map(serverFileName));
			await Promise.all(
				servers.map(async server => {
					const fileName = serverFileName(server);
					const serverUri = vscode.Uri.joinPath(this.serversDirectoryUri, fileName);
					const credentials = this.credentials.get(server.id) ?? {};
					const contents = Buffer.from(
						JSON.stringify(
							{
								...server,
								password: credentials.password ?? '',
								privateKey: credentials.privateKey ?? '',
								passphrase: credentials.passphrase ?? '',
								proxyPassword: credentials.proxyPassword ?? '',
								proxyPrivateKey: credentials.proxyPrivateKey ?? '',
								proxyPassphrase: credentials.proxyPassphrase ?? '',
							},
							undefined,
							2,
						),
					);
					if (await fileContentsEqual(serverUri, contents)) {
						return;
					}
					await writeFileAtomically(this.serversDirectoryUri, fileName, contents);
				}),
			);
			await writeFileAtomically(
				this.storageDirectoryUri,
				serverOrderFileName,
				Buffer.from(
					JSON.stringify(
						{ version: serverOrderVersion, serverIds: servers.map(server => server.id) },
						undefined,
						2,
					),
				),
			);
			await Promise.all(
				existingEntries
					.map(([name, type]) => ({ name, type }))
					.filter(
						({ name, type }) =>
							type === vscode.FileType.File &&
							name.endsWith('.json') &&
							name !== serverOrderFileName &&
							!expectedFiles.has(name) &&
							this.servers.some(server => serverFileName(server) === name),
					)
					.map(({ name }) =>
						vscode.workspace.fs.delete(vscode.Uri.joinPath(this.serversDirectoryUri, name)),
					),
			);
			this.servers = servers;
			this.changeEmitter.fire();
		} finally {
			this.writeInProgress = false;
		}
	}

	private async readServerOrder(): Promise<string[]> {
		try {
			const contents = await vscode.workspace.fs.readFile(
				vscode.Uri.joinPath(this.storageDirectoryUri, serverOrderFileName),
			);
			const value = JSON.parse(Buffer.from(contents).toString('utf8')) as unknown;
			if (!isServerOrder(value)) {
				return [];
			}
			return [...new Set(value.serverIds)];
		} catch {
			return [];
		}
	}

	private enqueueMutation(operation: () => Promise<void>): Promise<void> {
		const result = this.mutationQueue.then(operation, operation);
		this.mutationQueue = result.catch(() => undefined);
		return result;
	}

	private saveCredentials(server: Server, credentials: ServerCredentials, replace: boolean): void {
		const current = this.credentials.get(server.id) ?? {};
		if (usesPrivateKey(server)) {
			this.credentials.set(server.id, {
				privateKey: credentials.privateKey || (replace ? undefined : current.privateKey),
				passphrase:
					credentials.passphrase ||
					(replace || credentials.passphrase !== undefined ? undefined : current.passphrase),
				proxyPassword: credentials.proxyPassword || (replace ? undefined : current.proxyPassword),
				proxyPrivateKey:
					credentials.proxyPrivateKey || (replace ? undefined : current.proxyPrivateKey),
				proxyPassphrase:
					credentials.proxyPassphrase ||
					(replace || credentials.proxyPassphrase !== undefined
						? undefined
						: current.proxyPassphrase),
			});
			return;
		}

		this.credentials.set(server.id, {
			password: credentials.password || (replace ? undefined : current.password),
			proxyPassword: credentials.proxyPassword || (replace ? undefined : current.proxyPassword),
			proxyPrivateKey:
				credentials.proxyPrivateKey || (replace ? undefined : current.proxyPrivateKey),
			proxyPassphrase:
				credentials.proxyPassphrase ||
				(replace || credentials.proxyPassphrase !== undefined
					? undefined
					: current.proxyPassphrase),
		});
	}

	private assertServerType(server: Server): void {
		if (this.serverType && server.type !== this.serverType) {
			throw new Error('Connection type does not match this feature storage.');
		}
	}

	dispose(): void {
		this.watcher?.close();
		if (this.reloadTimer) {
			clearTimeout(this.reloadTimer);
		}
		this.changeEmitter.dispose();
	}
}

export const ServerStore = ConnectionStore;
export type ServerStore = Pick<ConnectionStore, keyof ConnectionStore>;

function serverFileName(server: Server): string {
	return `${encodeURIComponent(server.id)}.json`;
}

interface StoredServer {
	server: Server;
	credentials: ServerCredentials;
}

function parseStoredServer(value: unknown): StoredServer | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return undefined;
	}
	const record = value as Record<string, unknown>;
	let server: Server;
	try {
		server = parseServer(record);
	} catch {
		return undefined;
	}
	return {
		server,
		credentials: {
			password: typeof record.password === 'string' ? record.password : undefined,
			privateKey: typeof record.privateKey === 'string' ? record.privateKey : undefined,
			passphrase: typeof record.passphrase === 'string' ? record.passphrase : undefined,
			proxyPassword: typeof record.proxyPassword === 'string' ? record.proxyPassword : undefined,
			proxyPrivateKey:
				typeof record.proxyPrivateKey === 'string' ? record.proxyPrivateKey : undefined,
			proxyPassphrase:
				typeof record.proxyPassphrase === 'string' ? record.proxyPassphrase : undefined,
		},
	};
}

function isServerOrder(value: unknown): value is { version: number; serverIds: string[] } {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		(value as { version?: unknown }).version === serverOrderVersion &&
		Array.isArray((value as { serverIds?: unknown }).serverIds) &&
		(value as { serverIds: unknown[] }).serverIds.every(serverId => typeof serverId === 'string')
	);
}

async function fileContentsEqual(uri: vscode.Uri, expected: Uint8Array): Promise<boolean> {
	try {
		const current = await vscode.workspace.fs.readFile(uri);
		return Buffer.from(current).equals(Buffer.from(expected));
	} catch {
		return false;
	}
}

async function writeFileAtomically(
	directoryUri: vscode.Uri,
	fileName: string,
	contents: Uint8Array,
): Promise<void> {
	const targetUri = vscode.Uri.joinPath(directoryUri, fileName);
	const temporaryUri = vscode.Uri.joinPath(
		directoryUri,
		`.${fileName}.${process.pid}.${crypto.randomUUID()}.tmp`,
	);
	await vscode.workspace.fs.writeFile(temporaryUri, contents);
	await vscode.workspace.fs.rename(temporaryUri, targetUri, { overwrite: true });
}
