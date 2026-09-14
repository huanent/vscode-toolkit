import type {
	AuthType,
	ServerCommand,
} from '../../../../../src/features/ssh/formProtocol';
import type { ProxyFieldValues } from '../../../components/proxyFields';

export interface ConnectionFormValues extends ProxyFieldValues {
	location: string;
	name: string;
	group: string;
	host: string;
	port: string;
	username: string;
	authType: AuthType;
	password: string;
	privateKey: string;
	passphrase: string;
	commands: ServerCommand[];
	aiEnabled: boolean;
}
