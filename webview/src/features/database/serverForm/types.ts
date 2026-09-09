import type { AuthType, ProxyMode } from '../../../../../shared/protocol/database/form';

export interface ServerFormValues {
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
	proxyPassword: string;
	proxyPrivateKey: string;
	proxyPassphrase: string;
	password: string;
	database: string;
	aiEnabled: boolean;
}
