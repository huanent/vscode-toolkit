export type ServerType = 'mysql';
export type Server = MysqlServer;

export type AuthType = 'password' | 'privateKey';

export type ProxyMode = 'none' | 'ssh' | 'command';

interface BaseServer {
	id: string;
	type: ServerType;
	name: string;
	group: string;
	aiEnabled: boolean;
}

export interface SshProxy {
	credentialId: string;
	host: string;
	port: number;
}

export interface MysqlServer extends BaseServer {
	credentialId: string;
	type: 'mysql';
	host: string;
	port: number;
	database: string;
	proxy?: SshProxy;
}

export type ServerCredentials = Record<string, never>;

export interface ServerFormModel {
	location: string;
	locationLocked: boolean;
	workspaceFolders: { name: string; uri: string }[];
	serverType: ServerType;
	server?: Server;
	credentials: ServerCredentials;
	groups: string[];
}

export type ServerFormExtensionMessage =
	| { type: 'initialize'; model: ServerFormModel }
	| { type: 'executableSelected'; path: string }


	| { type: 'error'; message: string };
