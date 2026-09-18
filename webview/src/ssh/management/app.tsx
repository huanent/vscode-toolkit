import { useEffect, useState } from 'react';
import { ConnectionList, type ConnectionListState } from './components/connectionList';
import { sshApi, subscribe } from '../vscode';

export function SshConnections() {
	const send = (type: string, id?: string) => sshApi.postMessage({ type, id });
	const [state, setState] = useState<ConnectionListState>();
	const [query, setQuery] = useState('');
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			if (event.data.type === 'state') setState(event.data);
		};
		const unsubscribe = subscribe(receive);
		send('ready');
		return unsubscribe;
	}, []);
	return (
		<section className="py-2 text-(--vscode-foreground)">
			<ConnectionList state={state} query={query} onQueryChange={setQuery} onAction={send} />
		</section>
	);
}
