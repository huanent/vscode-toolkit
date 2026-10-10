import type { ServerCommand } from '@/shared/sshFormProtocol';
import type { ProxyFieldValues } from '@/webview/components/proxyFields';

export interface ConnectionFormValues extends ProxyFieldValues {
	proxyCredentialId: string;
	credentialId: string;
	location: string;
	name: string;
	group: string;
	host: string;
	port: string;
	commands: ServerCommand[];
	favorites: string[];
	aiEnabled: boolean;
}
