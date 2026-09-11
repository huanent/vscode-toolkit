import { useEffect, useState } from 'react';
import { ConnectionList, type ConnectionListState } from '../../../components/ConnectionList';
import { Dialog } from '../../../components/dialog';
import { send, subscribe } from '../../dashboard/channel';
import { App as ContainerForm } from '../serverForm/App';

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
		<section className="py-3 text-(--vscode-foreground)">
			<ConnectionList
				title="Container"
				state={state}
				query={query}
				onQueryChange={setQuery}
				onAction={action}
			/>
			{formSession !== undefined && (
				<Dialog title={state?.name ?? 'Container'} wide onClose={closeForm}>
					<ContainerForm key={formSession} sessionId={formSession} onClose={closeForm} />
				</Dialog>
			)}
		</section>
	);
}
