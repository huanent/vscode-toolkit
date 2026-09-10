import { vscode } from '../../vscodeApi';
import { send, subscribe, type Tab } from './channel';

export function formTransport(tab: Tab, sessionId?: number) {
	return {
		postMessage(message: object) {
			if (sessionId === undefined) vscode.postMessage(message);
			else send(tab, { type: 'formMessage', sessionId, message });
		},
		subscribe(listener: (event: MessageEvent) => void, onSaved?: () => void) {
			if (sessionId === undefined) {
				window.addEventListener('message', listener);
				return () => window.removeEventListener('message', listener);
			}
			return subscribe(tab, event => {
				if (event.data.sessionId !== sessionId) return;
				if (event.data.type === 'saved') onSaved?.();
				else listener(event);
			});
		},
	};
}
