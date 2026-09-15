import { useEffect, useState } from 'react';
import type { Result, ResultMessage } from '@/result/protocol';
import { vscode } from '@webview/vscodeApi';

export function useResult() {
	const [result, setResult] = useState<Result>();
	useEffect(() => {
		const listener = (event: MessageEvent<ResultMessage>) => {
			if (event.data.type === 'result') setResult(event.data.result);
		};
		window.addEventListener('message', listener);
		vscode.postMessage({ type: 'ready' });
		return () => window.removeEventListener('message', listener);
	}, []);
	return result;
}
