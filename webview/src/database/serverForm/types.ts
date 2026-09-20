import type { ProxyMode } from '../../../../src/database/formProtocol';

export interface ServerFormValues {
	credentialId: string;
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
	database: string;
	aiEnabled: boolean;
}
