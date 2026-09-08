import type {
	ExplorerRequest,
	PersistedExplorerState,
} from '../../../../../../shared/protocol/explorer/index';

const api = acquireVsCodeApi<PersistedExplorerState>();

export const vscode = {
	getState: () => api.getState(),
	setState: (state: PersistedExplorerState) => api.setState(state),
	postMessage: (message: ExplorerRequest) => api.postMessage(message),
};
