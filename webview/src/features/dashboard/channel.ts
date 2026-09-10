import { vscode } from '../../vscodeApi';

export type Tab = 'ssh' | 'workflow' | 'database' | 'container' | 'launchd';
export const send = (channel: Tab, message: object) => vscode.postMessage({ ...message, channel });
export function subscribe(channel: Tab, listener: (event: MessageEvent) => void) {
	const receive = (event: MessageEvent) => {
		if (event.data.channel === channel) listener(event);
	};
	window.addEventListener('message', receive);
	return () => window.removeEventListener('message', receive);
}

export const workflowApi = { postMessage: (message: object) => send('workflow', message) };
export const launchdApi = { postMessage: (message: object) => send('launchd', message) };
export const sshApi = { postMessage: (message: object) => send('ssh', message) };
