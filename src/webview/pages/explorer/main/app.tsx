import { useEffect, useRef } from 'react';
import { ArchiveProgress } from './components/archiveProgress';
import { ContextMenu } from './components/contextMenu';
import { FileList } from './components/fileList';
import { Toolbar } from './components/toolbar';
import { useExplorer } from './hooks/useExplorer';

interface AppProps {
	rootElement: HTMLElement;
}

export function App({ rootElement }: AppProps) {
	const model = useExplorer(rootElement);
	return (
		<div className="flex h-full min-h-0 flex-col" onClick={model.actions.closeContextMenu}>
			<WebviewFocusSink />
			<Toolbar {...model} />
			<FileList {...model} />
			<ContextMenu {...model} />
			<ArchiveProgress {...model} />
		</div>
	);
}

function WebviewFocusSink() {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const frame = requestAnimationFrame(() => inputRef.current?.focus());
		return () => cancelAnimationFrame(frame);
	}, []);

	return <input ref={inputRef} aria-hidden="true" tabIndex={-1} className="webview-focus-sink" />;
}
