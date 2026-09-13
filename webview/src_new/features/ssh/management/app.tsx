import { useEffect, useState } from 'react';
import { ConnectionList, type ConnectionListState } from './components/connectionList';
import { sshApi, subscribe } from '../services/vscode';
import { ConnectionDialog } from './components/connectionDialog';

export function SshConnections() {
	const send = (type: string, id?: string) => sshApi.postMessage({ type, id });
	const [formSession, setFormSession] = useState<number>();
	const [closeForm] = useState(() => () => {
		send('closeForm');
	});
	const [state, setState] = useState<ConnectionListState>();
	const [query, setQuery] = useState('');
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			if (event.data.type === 'state') setState(event.data);
			if (event.data.type === 'openForm') setFormSession(event.data.sessionId);
			if (event.data.type === 'formClosed') setFormSession(undefined);
		};
		const unsubscribe = subscribe(receive);
		send('ready');
		return unsubscribe;
	}, []);
	return (
		<section className="py-3 text-(--vscode-foreground)">
			<ConnectionList state={state} query={query} onQueryChange={setQuery} onAction={send} />
			{formSession !== undefined && (
				<ConnectionDialog key={formSession} sessionId={formSession} onClose={closeForm} />
			)}
		</section>
	);
}
