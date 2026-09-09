import { Connection, createConnection } from 'mysql2/promise';
import { MysqlServer } from '../server';
import { ServerCredentials } from '../serverStore';
import { createSshForward } from '../../ssh/sshConnection';

export async function createMysqlConnection(
	server: MysqlServer,
	credentials: ServerCredentials,
	database?: string,
): Promise<Connection> {
	const forward = server.proxy
		? await createSshForward(
				server.proxy,
				{
					password: credentials.proxyPassword,
					privateKey: credentials.proxyPrivateKey,
					passphrase: credentials.proxyPassphrase,
				},
				server.host,
				server.port,
			)
		: undefined;
	try {
		return await createConnection({
			host: server.host,
			port: server.port,
			user: server.username,
			password: credentials.password,
			database,
			...(forward ? { stream: forward.stream } : {}),
			connectTimeout: 15_000,
			dateStrings: true,
			supportBigNumbers: true,
			bigNumberStrings: true,
		});
	} catch (error) {
		forward?.dispose();
		throw error;
	}
}
