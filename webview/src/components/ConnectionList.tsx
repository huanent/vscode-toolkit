import { Download, Plus, RefreshCw, Upload } from './icons';
import { IconButton } from './button';
import { ConnectionCard, type Connection } from './ConnectionCard';
import { ConnectionGroup } from './ConnectionGroup';
import { DashboardEmpty, DashboardHeader, DashboardSearch } from '../features/dashboard/components';

export interface ConnectionListState {
	name: string;
	servers: Connection[];
}

export function ConnectionList({
	title,
	state,
	query,
	onQueryChange,
	onAction,
}: {
	title: string;
	state?: ConnectionListState;
	query: string;
	onQueryChange: (query: string) => void;
	onAction: (type: string, id?: string) => void;
}) {
	const search = query.trim().toLowerCase();
	const servers =
		state?.servers.filter(server =>
			`${server.name} ${server.group} ${server.address} ${server.kind}`
				.toLowerCase()
				.includes(search),
		) ?? [];
	const groups = new Map<string, Connection[]>();
	for (const server of servers) {
		const group = server.group.trim();
		const connections = groups.get(group);
		if (connections) connections.push(server);
		else groups.set(group, [server]);
	}
	return (
		<>
			<DashboardHeader title={state?.name ?? title} count={state ? servers.length : undefined}>
				<div className="flex items-center gap-0.5">
					<IconButton
						title="Import connections"
						aria-label="Import connections"
						onClick={() => onAction('import')}
					>
						<Upload size={15} />
					</IconButton>
					<IconButton
						title="Export connections"
						aria-label="Export connections"
						disabled={!state?.servers.length}
						onClick={() => onAction('exportAll')}
					>
						<Download size={15} />
					</IconButton>
					<IconButton title="Refresh" aria-label="Refresh" onClick={() => onAction('refresh')}>
						<RefreshCw size={15} />
					</IconButton>
					<IconButton
						title="New connection"
						aria-label="New connection"
						onClick={() => onAction('add')}
					>
						<Plus size={15} />
					</IconButton>
				</div>
			</DashboardHeader>
			<DashboardSearch label="Search connections" value={query} onChange={onQueryChange} />
			{!state ? (
				<DashboardEmpty loading noun="connections" />
			) : servers.length === 0 ? (
				<DashboardEmpty
					noun="connections"
					filtered={!!search}
					onClear={() => onQueryChange('')}
					onCreate={() => onAction('add')}
				/>
			) : (
				<div className="space-y-1">
					{Array.from(groups, ([group, connections]) => (
						<ConnectionGroup
							key={`${group}-${!!search}`}
							name={group}
							count={connections.length}
							filtered={!!search}
						>
							{connections.map(server => (
								<ConnectionCard
									key={server.id}
									server={server}
									compact
									filtered={!!search}
									onAction={onAction}
								/>
							))}
						</ConnectionGroup>
					))}
				</div>
			)}
		</>
	);
}
