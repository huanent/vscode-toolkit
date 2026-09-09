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
	host: string;
	port: number;
	username: string;
	authType: AuthType;
}

export interface MysqlServer extends BaseServer {
	type: 'mysql';
	host: string;
	port: number;
	username: string;
	database: string;
	proxy?: SshProxy;
}

export interface ServerCredentials {
	password?: string;
	privateKey?: string;
	passphrase?: string;
	proxyPassword?: string;
	proxyPrivateKey?: string;
	proxyPassphrase?: string;
}

export interface ServerFormModel {
	serverType: ServerType;
	server?: Server;
	credentials: ServerCredentials;
	groups: string[];
}

export type ServerFormExtensionMessage =
	| { type: 'initialize'; model: ServerFormModel }
	| { type: 'executableSelected'; path: string }
	| { type: 'privateKeySelected'; contents: string }
	| { type: 'proxyPrivateKeySelected'; contents: string }
	| { type: 'error'; message: string };
