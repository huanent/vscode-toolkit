import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { vscode } from '@webview/vscodeApi';
import { send, subscribe, type Tab } from './channel';
import { App as ContainerForm } from '../container/serverForm/app';

const tab = document.getElementById('root')!.dataset.tab as Tab;
document.body.dataset.toolkitEditor = 'true';
const close = () => vscode.postMessage({ type: 'closeEditor' });
function Editor() {
	const [sessionId, setSessionId] = useState<number>();
	const dirty = useRef(false);
	const saving = useRef(false);
	useEffect(() => {
		const unsubscribe = subscribe(tab, event => {
			if (event.data.type === 'openForm') {
				setSessionId(event.data.sessionId);
				dirty.current = false;
				saving.current = false;
			}
			if (event.data.type === 'error' || event.data.type === 'saved') saving.current = false;
			if (event.data.type === 'formClosed') close();
		});
		const receive = (event: MessageEvent) => {
			if (event.data.type !== 'editorRequest') return;
			if (saving.current || (dirty.current && !window.confirm('Discard unsaved changes?')))
				return;
			send(tab, event.data.request);
		};
		window.addEventListener('message', receive);
		vscode.postMessage({ type: 'editorReady' });
		return () => {
			unsubscribe();
			window.removeEventListener('message', receive);
		};
	}, []);
	return (
		<main
			className="mx-auto max-w-6xl p-4 text-(--vscode-foreground)"
			onChange={() => {
				dirty.current = true;
			}}
			onSubmit={() => {
				saving.current = true;
			}}
		>
			{sessionId === undefined ? (
				<p role="status">Loading...</p>
			) : (
				<ContainerForm key={sessionId} sessionId={sessionId} onClose={close} />
			)}
		</main>
	);
}
createRoot(document.getElementById('root')!).render(<Editor />);
