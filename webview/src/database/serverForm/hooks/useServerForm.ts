import { useEffect, useState } from 'react';
import type {
	ServerFormExtensionMessage,
	ServerFormModel,
} from '../../../../../src/database/formProtocol';
import { vscode } from '@webview/vscodeApi';
import type { ServerFormValues } from '../types';

const emptyValues: ServerFormValues = {
	credentialId: '',
	proxyCredentialId: '',
	location: '',
	name: '',
	group: '',
	aiEnabled: false,
	host: '',
	port: '3306',
	username: '',
	proxyCommand: '',
	proxyMode: 'none',
	proxyEnabled: false,
	proxyHost: '',
	proxyPort: '22',
	proxyUsername: '',
	proxyAuthType: 'password',




	database: '',
};

export function useServerForm() {
	const [model, setModel] = useState<ServerFormModel>();
	const [values, setValues] = useState(emptyValues);
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const handleMessage = (event: MessageEvent<ServerFormExtensionMessage>) => {
			const message = event.data;
			switch (message.type) {
				case 'initialize': {
					const nextModel = message.model;
					if (nextModel.serverType !== 'mysql') return;
					const server = nextModel.server?.type === 'mysql' ? nextModel.server : undefined;
					setModel(nextModel);
					setValues({
						...emptyValues,
						credentialId: server?.credentialId ?? '',
						proxyCredentialId: server?.proxy?.credentialId ?? '',
						location: nextModel.location ?? '',
						name: server?.name ?? '',
						group: server?.group ?? '',
						aiEnabled: server?.aiEnabled ?? false,
						host: server && 'host' in server ? (server.host ?? '') : '',
						port: String(server?.port ?? 3306),
						username: server && 'username' in server ? (server.username ?? '') : '',
						proxyCommand: '',
						proxyMode: server?.proxy ? 'ssh' : 'none',
						proxyEnabled: Boolean(server && 'proxy' in server && server.proxy),
						proxyHost: server && 'proxy' in server ? (server.proxy?.host ?? '') : '',
						proxyPort: String(server && 'proxy' in server ? (server.proxy?.port ?? 22) : 22),
						proxyUsername: server && 'proxy' in server ? (server.proxy?.username ?? '') : '',
						proxyAuthType:
							server && 'proxy' in server ? (server.proxy?.authType ?? 'password') : 'password',




						database: server?.type === 'mysql' ? server.database : '',
					});
					break;
				}
				case 'error':
					setError(message.message);
					setSaving(false);
					break;
			}
		};
		window.addEventListener('message', handleMessage);
		vscode.postMessage({ type: 'ready' });
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	const update = <Key extends keyof ServerFormValues>(key: Key, value: ServerFormValues[Key]) => {
		setError('');
		setValues(current => ({ ...current, [key]: value }));
	};
	const save = () => {
		setError('');
		setSaving(true);
		vscode.postMessage({ type: 'save', ...values });
	};

	return {
		model,
		values,
		error,
		saving,
		update,
		save,
	};
}

export type ServerFormState = ReturnType<typeof useServerForm>;
