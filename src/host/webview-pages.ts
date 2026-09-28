export const webviewPages = [
	{ id: 'toolkit.dashboard', page: 'dashboard' },
	{ id: 'toolkit.result', page: 'result' },
] as const;

export type WebviewPage = (typeof webviewPages)[number];
