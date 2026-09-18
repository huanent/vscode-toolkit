import { vscode } from '@webview/vscodeApi';

export const workflowApi = {
	postMessage: (message: object) => vscode.postMessage({ ...message, channel: 'workflow' }),
};

export function subscribe(listener: (event: MessageEvent) => void) {
	const receive = (event: MessageEvent) => {
		if (event.data.channel === 'workflow') listener(event);
	};
	window.addEventListener('message', receive);
	return () => window.removeEventListener('message', receive);
}