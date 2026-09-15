import { vscode } from '@webview/vscodeApi';

export const databaseApi=vscode;
export const connectionApi={
	postMessage: (message: object) => vscode.postMessage({ ...message, channel: 'database' }),
};

export function subscribe(listener: (event: MessageEvent) => void) {
	const receive=(event: MessageEvent) => {
		if(event.data.channel==='database') listener(event);
	};
	window.addEventListener('message', receive);
	return () => window.removeEventListener('message', receive);
}