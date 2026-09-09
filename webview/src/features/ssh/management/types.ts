import type {
	AuthType,
	ProxyMode,
	ServerCommand,
} from '../../../../../shared/protocol/ssh/form';

export interface ServerFormValues {
	name: string;
	group: string;
	host: string;
	port: string;
	username: string;
	authType: AuthType;
	proxyCommand: string;
	proxyMode: ProxyMode;
	proxyEnabled: boolean;
	proxyHost: string;
	proxyPort: string;
	proxyUsername: string;
	proxyAuthType: AuthType;
	proxyPassword: string;
	proxyPrivateKey: string;
	proxyPassphrase: string;
	password: string;
	privateKey: string;
	passphrase: string;
	commands: ServerCommand[];
	aiEnabled: boolean;
}
