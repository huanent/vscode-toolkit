import { useEffect } from 'react';
import type { ArchiveTreeEntry } from '@/features/archive/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { ArchiveContents } from '@/webview/pages/archive/components/archive-contents';
import { getRootData, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function App() {
	const state = useHostData<ArchiveTreeEntry[]>();
	const name = getRootData('name') ?? 'Archive';

	useEffect(() => {
		document.title = name;
	}, [name]);

	if (state.status === 'loaded') return <ArchiveContents name={name} entries={state.data} />;

	return (
		<main className="grid min-h-screen place-items-center bg-(--vscode-editor-background) p-4 text-(--vscode-foreground)">
			{state.status === 'loading' ? (
				<p className="text-(--vscode-descriptionForeground)" role="status">
					Reading archive...
				</p>
			) : (
				<p className="max-w-lg text-center text-(--vscode-errorForeground)" role="alert">
					{state.message}
				</p>
			)}
		</main>
	);
}

mountWebview('root', <App />);
