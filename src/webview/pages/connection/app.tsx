import { useEffect, useState } from 'react';
import { ConnectionList, type ConnectionListState } from './components/connectionList';
import { send, subscribe } from '../dashboard/channel';

const types = ['ssh', 'database', 'container'] as const;

export function Connections() {
    const [states, setStates] = useState<Partial<Record<typeof types[number], ConnectionListState>>>({});
    const [query, setQuery] = useState('');
    const [order, setOrder] = useState<string[]>([]);
    useEffect(() => {
        const unsubscribeOrder = subscribe('connection', event => {
            if (event.data.type === 'order') setOrder(event.data.order);
        });
        send('connection', { type: 'ready' });
        const subscriptions = types.map(connectionType => {
            const unsubscribe = subscribe(connectionType, event => {
                if (event.data.type === 'state') {
                    setStates(previous => ({
                        ...previous, [connectionType]: {
                            ...event.data,
                            servers: event.data.servers.map((server: ConnectionListState['servers'][number]) => ({
                                ...server, connectionType, commandCount: server.commandCount ?? 0,
                            })),
                        }
                    }));
                }
            });
            send(connectionType, { type: 'ready' });
            return unsubscribe;
        });
        return () => { unsubscribeOrder(); subscriptions.forEach(unsubscribe => unsubscribe()); };
    }, []);
    const positions = new Map(order.map((key, index) => [key, index]));
    const state = types.every(type => states[type]) ? {
        name: 'Connection', servers: types.flatMap(type => states[type]?.servers ?? []).sort((left, right) =>
            (positions.get(`${left.connectionType}:${left.id}`) ?? Infinity) - (positions.get(`${right.connectionType}:${right.id}`) ?? Infinity)),
    } : undefined;
    return (
        <section className="h-full min-h-0 py-2 text-(--vscode-foreground)">
            <ConnectionList state={state} query={query} onQueryChange={setQuery}
                onAction={(type, id, connectionType) => send(connectionType ?? 'connection', { type, id })} />
        </section>
    );
}