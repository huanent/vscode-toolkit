import type * as vscode from 'vscode';

export function createFormSession<Server, Credentials, Message>(
	panel: vscode.WebviewPanel,
	getCredentials: (server: Server) => Promise<Credentials>,
	emptyCredentials: Credentials,
	handle: (
		message: Message,
		server: Server | undefined,
		credentials: Credentials,
		duplicate: boolean,
		state: { inProgress: boolean },
		saved: () => void,
		sessionId: number,
	) => Promise<void>,
) {
	let sequence = 0;
	let form:
		| {
				sessionId: number;
				server?: Server;
				credentials: Credentials;
				duplicate: boolean;
				inProgress: boolean;
		  }
		| undefined;
	return {
		async open(server?: Server, duplicate = false) {
			if (form?.inProgress) return;
			const sessionId = ++sequence;
			const credentials = server ? await getCredentials(server) : emptyCredentials;
			if (sequence !== sessionId) return;
			form = { sessionId, server, credentials, duplicate, inProgress: false };
			await panel.webview.postMessage({ type: 'openForm', sessionId });
		},
		async receive(request: { type?: string; sessionId?: number; message?: Message }) {
			if (request.type === 'closeForm') {
				if (!form?.inProgress) {
					form = undefined;
					sequence++;
					await panel.webview.postMessage({ type: 'formClosed' });
				}
				return true;
			}
			if (request.type !== 'formMessage') return false;
			const active = form;
			if (active && request.sessionId === active.sessionId && request.message) {
				await handle(
					request.message,
					active.server,
					active.credentials,
					active.duplicate,
					active,
					() => {
						if (form === active) form = undefined;
						void panel.webview.postMessage({ type: 'saved', sessionId: active.sessionId });
					},
					active.sessionId,
				);
			}
			return true;
		},
		dispose() {
			sequence++;
			form = undefined;
		},
	};
}
