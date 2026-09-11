import { useEffect, useState } from 'react';
import { ConnectionList, type ConnectionListState } from '../../../components/ConnectionList';
import { Dialog } from '../../../components/dialog';
import { send, subscribe } from '../../dashboard/channel';
import { App as DatabaseForm } from '../serverForm/App';

const action = (type: string, id?: string) => send('database', { type, id });
const closeForm = () => action('closeForm');

export function DatabaseConnections() {
	const [state, setState] = useState<ConnectionListState>();
	const [query, setQuery] = useState('');
	const [formSession, setFormSession] = useState<number>();
	useEffect(() => {
		const unsubscribe = subscribe('database', event => {
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
				title="Database"
				state={state}
				query={query}
				onQueryChange={setQuery}
				onAction={action}
			/>
			{formSession !== undefined && (
				<Dialog title={state?.name ?? 'Database'} wide onClose={closeForm}>
					<DatabaseForm key={formSession} sessionId={formSession} onClose={closeForm} />
				</Dialog>
			)}
		</section>
	);
}
