export type ServerType = 'ssh';
export type Server = SshServer;

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

export interface SshServer extends BaseServer {
	type: 'ssh';
	host: string;
	port: number;
	username: string;
	authType: AuthType;
	proxyCommand?: string;
	proxy?: SshProxy;
	commands: ServerCommand[];
}

export interface ServerCommand {
	name: string;
	value: string;
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
	| { type: 'privateKeySelected'; contents: string }
	| { type: 'proxyPrivateKeySelected'; contents: string }
	| { type: 'error'; message: string };
