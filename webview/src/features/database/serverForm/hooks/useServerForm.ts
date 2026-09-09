import { useEffect, useState } from 'react';
import type { ServerFormValues } from '../types';
import { vscode } from '../../../../vscodeApi';
import type {
	ServerFormExtensionMessage,
	ServerFormModel,
} from '../../../../../../shared/protocol/database/form';

const emptyValues: ServerFormValues = {
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
	proxyPassword: '',
	proxyPrivateKey: '',
	proxyPassphrase: '',
	password: '',
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
						proxyPassword: nextModel.credentials.proxyPassword ?? '',
						proxyPrivateKey: nextModel.credentials.proxyPrivateKey ?? '',
						proxyPassphrase: nextModel.credentials.proxyPassphrase ?? '',
						password: nextModel.credentials.password ?? '',
						database: server?.type === 'mysql' ? server.database : '',
					});
					break;
				}
				case 'proxyPrivateKeySelected':
					setValues(current => ({ ...current, proxyPrivateKey: message.contents }));
					break;
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
		selectProxyPrivateKey: () => vscode.postMessage({ type: 'selectProxyPrivateKey' }),
	};
}

export type ServerFormState = ReturnType<typeof useServerForm>;
