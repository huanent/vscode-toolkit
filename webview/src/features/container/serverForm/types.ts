import type {
	AuthType,
	ContainerRuntime,
	ConnectionType,
	ProxyMode,
} from '../../../../../shared/protocol/container/form';

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
	runtime: ContainerRuntime;
	executablePath: string;
	connectionType: ConnectionType;
	sshServerId: string;
	aiEnabled: boolean;
}
