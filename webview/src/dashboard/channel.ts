import { vscode } from '@webview/vscodeApi';

export type Tab = 'ssh' | 'workflow' | 'database' | 'container';
type Channel = Tab | 'credential';
export const send = (channel: Channel, message: object) => vscode.postMessage({ ...message, channel });
export function subscribe(channel: Channel, listener: (event: MessageEvent) => void) {
	const receive = (event: MessageEvent) => {
		if (event.data.channel === channel) listener(event);
	};
	window.addEventListener('message', receive);
	return () => window.removeEventListener('message', receive);
}

export const workflowApi = { postMessage: (message: object) => send('workflow', message) };
export const sshApi = { postMessage: (message: object) => send('ssh', message) };
