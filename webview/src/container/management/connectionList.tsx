import { useState } from 'react';
import { DashboardEmpty, DashboardHeader, DashboardSearch } from '@webview/dashboard/components';
import { IconButton } from '@webview/components/ui/button';
import { List, ListGroup, ListItem } from '@webview/components/ui/list';
import { Container, Copy, Download, Pencil, Play, Plus, RefreshCw, Trash2, Upload, ArrowUp, ArrowDown } from '@webview/components/ui/icons';

export interface ConnectionListState {
    name: string;
    servers: { id: string; name: string; group: string; address: string; kind: string }[];
}

export function ConnectionList({ title, state, query, onQueryChange, onAction }: {
    title: string;
    state?: ConnectionListState;
    query: string;
    onQueryChange(query: string): void;
    onAction(type: string, id?: string): void;
}) {
    const [selectedId, setSelectedId] = useState<string>();
    const servers = state?.servers.filter(server => `${server.name} ${server.group} ${server.address} ${server.kind}`.toLowerCase().includes(query.trim().toLowerCase())) ?? [];
    const groups = new Map<string, ConnectionListState['servers']>();
    for (const server of servers) {
        const group = server.group.trim();
        const connections = groups.get(group);
        if (connections) connections.push(server);
        else groups.set(group, [server]);
    }
    return <>
        <DashboardHeader title={state?.name ?? title} count={state ? servers.length : undefined}>
            <IconButton icon={<Upload />} label="Import connections" onClick={() => onAction('import')} />
            <IconButton icon={<Download />} label="Export connections" disabled={!state?.servers.length} onClick={() => onAction('exportAll')} />
            <IconButton icon={<RefreshCw />} label="Refresh" onClick={() => onAction('refresh')} />
            <IconButton icon={<Plus />} label="New connection" onClick={() => onAction('add')} />
        </DashboardHeader>
        <DashboardSearch label="Search connections" value={query} onChange={onQueryChange} />
        {!state || !servers.length ? <DashboardEmpty loading={!state} noun="connections" filtered={!!query.trim()} onClear={() => onQueryChange('')} onCreate={() => onAction('add')} /> : <List>
            {Array.from(groups, ([group, connections]) => <ListGroup key={group} label={group || 'Ungrouped'}>
                {connections.map(server => <ListItem key={server.id} selected={selectedId === server.id} onSelect={() => setSelectedId(server.id)} icon={<Container />} description={server.address} actions={<>
                    <IconButton icon={<Play />} label="Open" onClick={() => onAction('connect', server.id)} />
                    <IconButton icon={<Pencil />} label="Edit" onClick={() => onAction('edit', server.id)} />
                    <IconButton icon={<Copy />} label="Duplicate" onClick={() => onAction('duplicate', server.id)} />
                    <IconButton icon={<Download />} label="Export" onClick={() => onAction('export', server.id)} />
                    <IconButton icon={<ArrowUp />} label="Move up" onClick={() => onAction('moveUp', server.id)} />
                    <IconButton icon={<ArrowDown />} label="Move down" onClick={() => onAction('moveDown', server.id)} />
                    <IconButton icon={<Trash2 />} label="Delete" onClick={() => onAction('delete', server.id)} />
                </>}>{server.name}</ListItem>)}
            </ListGroup>)}
        </List>}
    </>;
}