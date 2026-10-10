import type { ContainerRuntime, ConnectionType, ProxyMode } from '@/shared/containerFormProtocol';

export interface ServerFormValues {
	proxyCredentialId: string;
	location: string;
	name: string;
	group: string;
	host: string;
	port: string;
	proxyCommand: string;
	proxyMode: ProxyMode;
	proxyEnabled: boolean;
	proxyHost: string;
	proxyPort: string;
	runtime: ContainerRuntime;
	executablePath: string;
	connectionType: ConnectionType;
	sshServerId: string;
	aiEnabled: boolean;
}
