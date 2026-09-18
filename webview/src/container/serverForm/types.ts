import type {
	AuthType,
	ContainerRuntime,
	ConnectionType,
	ProxyMode,
} from '../../../../src/container/formProtocol';

export interface ServerFormValues {
	proxyCredentialId: string;
	location: string;
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
	runtime: ContainerRuntime;
	executablePath: string;
	connectionType: ConnectionType;
	sshServerId: string;
	aiEnabled: boolean;
}
