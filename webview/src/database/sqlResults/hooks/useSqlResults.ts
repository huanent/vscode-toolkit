import { useEffect, useState } from 'react';
import { databaseApi as vscode } from '../../services/vscode';

type SqlResult=
	|{
		serverName: string;
		database: string;
		summary: string;
		kind: 'rows';
		columns: string[];
		rows: Array<Array<string|null>>;
	}
	|{ serverName: string; database: string; summary: string; kind: 'command'; message: string };

export function useSqlResults() {
	const [result, setResult]=useState<SqlResult>();
	useEffect(() => {
		const listener=(event: MessageEvent<{ type: 'result'; result: SqlResult }>) => {
			if(event.data.type==='result') setResult(event.data.result);
		};
		window.addEventListener('message', listener);
		vscode.postMessage({ type: 'ready' });
		return () => window.removeEventListener('message', listener);
	}, []);
	return result;
}
