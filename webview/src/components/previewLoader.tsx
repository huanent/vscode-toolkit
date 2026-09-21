import { useEffect, useState, type ReactNode } from 'react';
import { Loading } from './ui/loading';

type PreviewMessage<T> = { type: 'loaded'; data: T } | { type: 'error'; message: string };

const vscode = acquireVsCodeApi();

export function PreviewLoader<T>({
	loadingLabel,
	errorLabel,
	render,
}: {
	loadingLabel: string;
	errorLabel: string;
	render: (data: T) => ReactNode;
}) {
	const [message, setMessage] = useState<PreviewMessage<T>>();

	useEffect(() => {
		const handleMessage = (event: MessageEvent<PreviewMessage<T>>) => setMessage(event.data);
		window.addEventListener('message', handleMessage);
		vscode.postMessage({ type: 'ready' });
		return () => window.removeEventListener('message', handleMessage);
	}, []);

	if (message?.type === 'loaded') return render(message.data);
	return (
		<main className="grid h-full place-items-center bg-(--vscode-editor-background) text-sm text-(--vscode-descriptionForeground)">
			{message?.type === 'error' ? `${errorLabel}: ${message.message}` : <Loading label={loadingLabel} />}
		</main>
	);
}
