import { vscode } from '@webview/vscodeApi';

export const databaseApi = vscode;

export function subscribe(listener: (event: MessageEvent) => void) {
	const receive = (event: MessageEvent) => {
		if (event.data.channel === 'database') listener(event);
	};
	window.addEventListener('message', receive);
	return () => window.removeEventListener('message', receive);
}