import { StrictMode, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

export function mountWebview(elementId: string, app: ReactElement): void {
	const rootElement = document.getElementById(elementId);

	if (!rootElement) {
		throw new Error(`Webview root element "${elementId}" was not found`);
	}

	createRoot(rootElement).render(<StrictMode>{app}</StrictMode>);
}
