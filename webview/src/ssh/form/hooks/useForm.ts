import { useEffect, useState } from 'react';
import type { ConnectionFormValues } from '../types';
import { sshApi as vscode, subscribe } from '../../vscode';
import type {
	ServerFormExtensionMessage,
	ServerFormModel,
} from '@/ssh/formProtocol';

const emptyValues: ConnectionFormValues = {
	proxyCredentialId: '',
	credentialId: '',
	location: '',
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






	commands: [],
	favorites: [],
};

export function useForm(sessionId: number, onClose: () => void) {
	const [model, setModel] = useState<ServerFormModel>();
	const [values, setValues] = useState(emptyValues);
	const [error, setError] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		const handleMessage = (
			event: MessageEvent<
				(ServerFormExtensionMessage | { type: 'saved' }) & { sessionId?: number }
			>,
		) => {
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
						proxyCredentialId: server?.proxy?.credentialId ?? '',
						credentialId: server?.credentialId ?? '',
						location: nextModel.location ?? '',
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



						commands: server?.type === 'ssh' ? server.commands : [],
						favorites: server?.favorites ?? [],



					});
					break;
				}
				case 'error':
					setError(message.message);
					setSaving(false);
					break;
			}
		};
		const unsubscribe = subscribe(handleMessage);
		vscode.postMessage({ type: 'formMessage', sessionId, message: { type: 'ready' } });
		return unsubscribe;
	}, [sessionId, onClose]);

	const update = <Key extends keyof ConnectionFormValues>(key: Key, value: ConnectionFormValues[Key]) => {
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
	};
}

export type ConnectionFormState = ReturnType<typeof useForm>;
