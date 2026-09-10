import { useEffect, useState } from 'react';
import type { ServerFormValues } from '../types';
import { formTransport } from '../../../dashboard/formTransport';
import type {
	ServerFormExtensionMessage,
	ServerFormModel,
} from '../../../../../../src/features/container/formProtocol';

const emptyValues: ServerFormValues = {
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
	proxyPassword: '',
	proxyPrivateKey: '',
	proxyPassphrase: '',
	password: '',
	privateKey: '',
	passphrase: '',
	runtime: 'docker',
	executablePath: 'docker',
	connectionType: 'local',
	sshServerId: '',
};

export function useServerForm(sessionId?: number, onClose?: () => void) {
	const vscode = formTransport('container', sessionId);
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
					if (nextModel.serverType !== 'container') return;
					const server = nextModel.server;
					const container = server?.type === 'container' ? server : undefined;
					const manualContainerSsh = container?.connectionType === 'ssh' && !container.sshServerId;
					const referencedContainerSsh =
						container?.connectionType === 'ssh' && container.sshServerId
							? nextModel.sshServers.find(candidate => candidate.id === container.sshServerId)
							: undefined;
					setModel(nextModel);
					setValues({
						...emptyValues,
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
							container?.connectionType === 'ssh' ||
							Boolean(server && 'proxy' in server && server.proxy)
								? 'ssh'
								: server && 'proxyCommand' in server && server.proxyCommand
									? 'command'
									: 'none',
						proxyEnabled: container
							? container.connectionType === 'ssh'
							: Boolean(server && 'proxy' in server && server.proxy),
						proxyHost: manualContainerSsh
							? (container.host ?? '')
							: (referencedContainerSsh?.host ??
								(server && 'proxy' in server ? (server.proxy?.host ?? '') : '')),
						proxyPort: String(
							manualContainerSsh
								? (container.port ?? 22)
								: (referencedContainerSsh?.port ??
										(server && 'proxy' in server ? (server.proxy?.port ?? 22) : 22)),
						),
						proxyUsername: manualContainerSsh
							? (container.username ?? '')
							: (referencedContainerSsh?.username ??
								(server && 'proxy' in server ? (server.proxy?.username ?? '') : '')),
						proxyAuthType: manualContainerSsh
							? (container.authType ?? 'password')
							: (referencedContainerSsh?.authType ??
								(server && 'proxy' in server
									? (server.proxy?.authType ?? 'password')
									: 'password')),
						proxyPassword: manualContainerSsh
							? (nextModel.credentials.password ?? '')
							: (nextModel.credentials.proxyPassword ?? ''),
						proxyPrivateKey: manualContainerSsh
							? (nextModel.credentials.privateKey ?? '')
							: (nextModel.credentials.proxyPrivateKey ?? ''),
						proxyPassphrase: manualContainerSsh
							? (nextModel.credentials.passphrase ?? '')
							: (nextModel.credentials.proxyPassphrase ?? ''),
						password: nextModel.credentials.password ?? '',
						privateKey: nextModel.credentials.privateKey ?? '',
						passphrase: nextModel.credentials.passphrase ?? '',
						runtime: container?.runtime ?? 'docker',
						executablePath: container?.executablePath ?? 'docker',
						connectionType: container?.connectionType ?? 'local',
						sshServerId: container?.sshServerId ?? '',
					});
					break;
				}
				case 'executableSelected':
					setValues(current => ({ ...current, executablePath: message.path }));
					break;
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
		const unsubscribe = vscode.subscribe(handleMessage, onClose);
		vscode.postMessage({ type: 'ready' });
		return unsubscribe;
	}, [sessionId, onClose]);

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
		selectExecutable: () => vscode.postMessage({ type: 'selectExecutable' }),
		selectPrivateKey: () => vscode.postMessage({ type: 'selectPrivateKey' }),
		selectProxyPrivateKey: () => vscode.postMessage({ type: 'selectProxyPrivateKey' }),
	};
}

export type ServerFormState = ReturnType<typeof useServerForm>;
