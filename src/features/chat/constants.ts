export const commandIds = {
	open: 'vscode-toolkit.openChat',
	newChat: 'vscode-toolkit.newChat',
	newTab: 'vscode-toolkit.newChatTab',
} as const;

export const editorViewType = 'vscode-toolkit.chatEditor';
export const webviewFocusContextKey = 'vscode-toolkit.chatWebviewFocus';

export const storageKeys = {
	selectedModel: 'vscode-toolkit.chat.selectedModelId',
	cachedModels: 'vscode-toolkit.chat.cachedModels',
	currentSession: 'vscode-toolkit.chat.currentSessionId',
} as const;
