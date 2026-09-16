import { useState } from 'react';
import { DashboardEmpty, DashboardHeader, DashboardSearch } from '@webview/dashboard/components';
import { Button, IconButton } from '@webview/components/ui/button';
import { Popover } from '@webview/components/ui/popover';
import { List, ListGroup, ListItem } from '@webview/components/ui/list';
import { Container, Download, Play, Plus, RefreshCw, Upload } from '@webview/components/ui/icons';

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
    const [menu, setMenu] = useState<{ server: ConnectionListState['servers'][number]; x: number; y: number }>();
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
                {connections.map(server => <ListItem key={server.id} selected={selectedId === server.id} onSelect={() => setSelectedId(server.id)}
                    onContextMenu={event => {
                        event.preventDefault();
                        setSelectedId(server.id);
                        setMenu({ server, x: event.clientX, y: event.clientY });
                    }}
                    onKeyDown={event => {
                        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
                        event.preventDefault();
                        const bounds = event.currentTarget.getBoundingClientRect();
                        setSelectedId(server.id);
                        setMenu({ server, x: bounds.left, y: bounds.bottom });
                    }}
                    icon={<Container />} description={server.address} actions={<>
                    <IconButton icon={<Play />} label="Open" onClick={() => onAction('connect', server.id)} />
                </>}>{server.name}</ListItem>)}
            </ListGroup>)}
        </List>}
        {menu && <Popover open onOpenChange={open => { if (!open) setMenu(undefined); }} label={`Actions for ${menu.server.name}`} placement="bottom-start" anchorPosition={menu}>
            <div className="grid min-w-40 p-1">
                {[
                    ['edit', 'Edit'],
                    ['duplicate', 'Duplicate'],
                    ['export', 'Export'],
                    ['moveUp', 'Move up'],
                    ['moveDown', 'Move down'],
                    ['delete', 'Delete'],
                ].map(([type, label]) => <Button key={type} variant="text" className="w-full justify-start" onClick={() => {
                    setMenu(undefined);
                    onAction(type, menu.server.id);
                }}>{label}</Button>)}
            </div>
        </Popover>}
    </>;
}