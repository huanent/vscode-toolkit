import { vscode } from '@webview/vscodeApi';

export const terminalApi = vscode;
export const sshApi = {
	postMessage: (message: object) => vscode.postMessage({ ...message, channel: 'ssh' }),
};

export function subscribe(listener: (event: MessageEvent) => void) {
	const receive = (event: MessageEvent) => {
		if (event.data.channel === 'ssh') listener(event);
	};
	window.addEventListener('message', receive);
	return () => window.removeEventListener('message', receive);
}