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
	credentialId: string;
	host: string;
	port: number;
}

export interface SshServer extends BaseServer {
	credentialId?: string;
	type: 'ssh';
	host: string;
	port: number;
	proxyCommand?: string;
	proxy?: SshProxy;
	commands: ServerCommand[];
	favorites?: string[];
}

export interface ServerCommand {
	name: string;
	value: string;
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
