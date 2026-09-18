import type { AuthType, ProxyMode } from '../../../../src/database/formProtocol';

export interface ServerFormValues {
	credentialId: string;
	proxyCredentialId: string;
	location: string;
	name: string;
	group: string;
	host: string;
	port: string;
	username: string;
	proxyCommand: string;
	proxyMode: ProxyMode;
	proxyEnabled: boolean;
	proxyHost: string;
	proxyPort: string;
	proxyUsername: string;
	proxyAuthType: AuthType;
	database: string;
	aiEnabled: boolean;
}
