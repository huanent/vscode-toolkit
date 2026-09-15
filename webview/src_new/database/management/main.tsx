import { useEffect, useState } from 'react';
import { connectionApi, subscribe } from '../services/vscode';
import { ConnectionList, type ConnectionListState } from './components/connectionList';

const action = (type: string, id?: string) => connectionApi.postMessage({ type, id });

export function DatabaseConnections() {
	const [state, setState] = useState<ConnectionListState>();
	const [query, setQuery] = useState('');
	useEffect(() => {
		const unsubscribe = subscribe(event => {
			if (event.data.type === 'state') setState(event.data);
		});
		action('ready');
		return unsubscribe;
	}, []);
	return (
		<section className="py-3 text-(--vscode-foreground)">
			<ConnectionList
				state={state}
				query={query}
				onQueryChange={setQuery}
				onAction={action}
			/>
		</section>
	);
}
