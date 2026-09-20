import { useEffect, useState } from 'react';
import { ConnectionList, type ConnectionListState } from './connectionList';
import { Dialog } from '@webview/components/ui/dialog';
import { send, subscribe } from '@webview/dashboard/channel';
import { App as ContainerForm } from '../serverForm/app';

const action = (type: string, id?: string) => send('container', { type, id });
const closeForm = () => action('closeForm');

export function ContainerConnections() {
	const [state, setState] = useState<ConnectionListState>();
	const [query, setQuery] = useState('');
	const [formSession, setFormSession] = useState<number>();
	useEffect(() => {
		const unsubscribe = subscribe('container', event => {
			if (event.data.type === 'state') setState(event.data);
			if (event.data.type === 'openForm') setFormSession(event.data.sessionId);
			if (event.data.type === 'formClosed') setFormSession(undefined);
		});
		action('ready');
		return unsubscribe;
	}, []);
	return (
		<section className="h-full min-h-0 py-2 text-(--vscode-foreground)">
			<ConnectionList
				title="Container"
				state={state}
				query={query}
				onQueryChange={setQuery}
				onAction={action}
			/>
			{formSession !== undefined && (
				<Dialog open title={state?.name ?? 'Container'} size="lg" onClose={closeForm}>
					<ContainerForm key={formSession} sessionId={formSession} onClose={closeForm} />
				</Dialog>
			)}
		</section>
	);
}
