import { useEffect, useState } from 'react';
import type { Result, ResultMessage, ResultHistoryMessage } from '@/result/protocol';
import { vscode } from '@webview/vscodeApi';

export function useResult() {
	const [result, setResult] = useState<Result>();
	const [history, setHistory] = useState<ResultHistoryMessage>({ type: 'history', tasks: [] });
	useEffect(() => {
		const listener = (event: MessageEvent<ResultMessage | ResultHistoryMessage>) => {
			if (event.data.type === 'result') setResult(event.data.result);
			else if (event.data.type === 'history') {
				setHistory(event.data);
				if (!event.data.selectedId) setResult(undefined);
			}
		};
		window.addEventListener('message', listener);
		vscode.postMessage({ type: 'ready' });
		return () => window.removeEventListener('message', listener);
	}, []);
	return { result, history };
}
