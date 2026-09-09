import { SshServer } from './server';
import { ServerCredentials, ServerStore } from './serverStore';

let activeStore: ServerStore | undefined;

export function registerSshConnectionService(store: ServerStore): { dispose(): void } {
	activeStore = store;
	return {
		dispose() {
			if (activeStore === store) activeStore = undefined;
		},
	};
}

export function listSshConnections(): SshServer[] {
	return (
		activeStore?.getServers().filter((server): server is SshServer => server.type === 'ssh') ?? []
	);
}

export async function resolveSshConnection(serverId: string): Promise<{
	server: SshServer;
	credentials: ServerCredentials;
}> {
	const server = listSshConnections().find(candidate => candidate.id === serverId);
	if (!server || !activeStore) throw new Error('The selected SSH connection no longer exists.');
	return { server, credentials: await activeStore.getCredentials(serverId) };
}
