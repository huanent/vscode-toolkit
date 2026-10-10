import type { ExplorerRequest, PersistedExplorerState } from '@/shared/explorerProtocol';

const api = acquireVsCodeApi<PersistedExplorerState>();

export const vscode = {
	getState: () => api.getState(),
	setState: (state: PersistedExplorerState) => api.setState(state),
	postMessage: (message: ExplorerRequest) => api.postMessage(message),
};
