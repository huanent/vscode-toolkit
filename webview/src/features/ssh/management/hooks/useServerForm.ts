import { useEffect, useState } from 'react';
import type { ServerFormValues } from '../types';
import { vscode } from '../../../../vscodeApi';
import type {
	ServerFormExtensionMessage,
	ServerFormModel,
} from '../../../../../../shared/protocol/connections/form';

const emptyValues: ServerFormValues = {
	name: '',
	group: '',
	aiEnabled: false,
	host: '',
	port: '22',
	username: '',
	authType: 'password',
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
	privateKey: '',
	passphrase: '',
	commands: [],
};

export function useServerForm(sessionId: number, onClose: () => void) {
	const [model, setModel] = useState<ServerFormModel>();
	const [values, setValues] = useState(emptyValues);
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const handleMessage = (event: MessageEvent<(ServerFormExtensionMessage | { type: 'saved' }) & { sessionId?: number }>) => {
			const message = event.data;
			if (message.sessionId !== sessionId) return;
			switch (message.type) {
				case 'saved':
					onClose();
					break;
				case 'initialize': {
					const nextModel = message.model;
					if (nextModel.serverType !== 'ssh') return;
					const server = nextModel.server;
					setModel(nextModel);
					setValues({
						...emptyValues,
						name: server?.name ?? '',
						group: server?.group ?? '',
						aiEnabled: server?.aiEnabled ?? false,
						host: server && 'host' in server ? (server.host ?? '') : '',
						port: String(server && 'port' in server ? (server.port ?? 22) : 22),
						username: server && 'username' in server ? (server.username ?? '') : '',
						authType: server && 'authType' in server ? (server.authType ?? 'password') : 'password',
						proxyCommand: server && 'proxyCommand' in server ? (server.proxyCommand ?? '') : '',
						proxyMode:
							server && 'proxy' in server && server.proxy
								? 'ssh'
								: server && 'proxyCommand' in server && server.proxyCommand
									? 'command'
									: 'none',
						proxyEnabled: Boolean(server && 'proxy' in server && server.proxy),
						proxyHost: server && 'proxy' in server ? (server.proxy?.host ?? '') : '',
						proxyPort: String(server && 'proxy' in server ? (server.proxy?.port ?? 22) : 22),
						proxyUsername: server && 'proxy' in server ? (server.proxy?.username ?? '') : '',
						proxyAuthType:
							server && 'proxy' in server ? (server.proxy?.authType ?? 'password') : 'password',
						proxyPassword: nextModel.credentials.proxyPassword ?? '',
						proxyPrivateKey: nextModel.credentials.proxyPrivateKey ?? '',
						proxyPassphrase: nextModel.credentials.proxyPassphrase ?? '',
						commands: server?.type === 'ssh' ? server.commands : [],
						password: nextModel.credentials.password ?? '',
						privateKey: nextModel.credentials.privateKey ?? '',
						passphrase: nextModel.credentials.passphrase ?? '',
					});
					break;
				}
				case 'privateKeySelected':
					setValues(current => ({ ...current, privateKey: message.contents }));
					break;
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
		vscode.postMessage({ type: 'formMessage', sessionId, message: { type: 'ready' } });
		return () => window.removeEventListener('message', handleMessage);
	}, [sessionId, onClose]);

	const update = <Key extends keyof ServerFormValues>(key: Key, value: ServerFormValues[Key]) => {
		setError('');
		setValues(current => ({ ...current, [key]: value }));
	};
	const save = () => {
		setError('');
		setSaving(true);
		vscode.postMessage({ type: 'formMessage', sessionId, message: { type: 'save', ...values } });
	};

	return {
		model,
		values,
		error,
		saving,
		update,
		save,
		selectPrivateKey: () => vscode.postMessage({ type: 'formMessage', sessionId, message: { type: 'selectPrivateKey' } }),
		selectProxyPrivateKey: () => vscode.postMessage({ type: 'formMessage', sessionId, message: { type: 'selectProxyPrivateKey' } }),
	};
}

export type ServerFormState = ReturnType<typeof useServerForm>;
