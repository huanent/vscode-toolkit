import { Button, IconButton } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import {
	Download,
	Upload,
	Plus,
	RefreshCw,
	Search,
	X,
} from '../../../components/ui/icons';
import { Input } from '../../../components/ui/input';
import { List } from '../../../components/ui/list';
import { Toolbar } from '../../../components/ui/toolbar';
import { Tree } from '../../../components/ui/tree';
import { ConnectionItem, type Connection } from './connectionItem';

export type ConnectionListState = { name: string; servers: Connection[] };

export function ConnectionList({
	state,
	query,
	onQueryChange,
	onAction,
}: {
	state?: ConnectionListState;
	query: string;
	onQueryChange(value: string): void;
	onAction(type: string, id?: string): void;
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
		groups.set(group, [...(groups.get(group) ?? []), server]);
	}
	return (
		<div className="grid h-full min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2">
			<Toolbar title={state?.name ?? 'Database'}>
				<IconButton icon={<Upload />} label="Import connections" onClick={() => onAction('import')} />
				<IconButton icon={<Download />} label="Export connections" disabled={!state?.servers.length} onClick={() => onAction('exportAll')} />
				<IconButton icon={<RefreshCw />} label="Refresh" onClick={() => onAction('refresh')} />
				<IconButton icon={<Plus />} label="New connection" onClick={() => onAction('add')} />
			</Toolbar>
			<Input
				left={<Search />}
				right={query ? (
					<IconButton
						size="sm"
						icon={<X />}
						label="Clear search"
						onClick={() => onQueryChange('')}
					/>
				) : undefined}
				type="search"
				aria-label="Search connections"
				placeholder="Search connections"
				value={query}
				onChange={event => onQueryChange(event.target.value)}
			/>
			<div className="min-h-0 overflow-y-auto">
				{!state ? (
					<Empty
						icon={<RefreshCw className="codicon-modifier-spin" />}
						title="Loading connections"
						role="status"
					/>
				) : servers.length === 0 ? (
					<div>
						<Empty
							title={search ? 'No matching connections' : 'No connections'}
						/>
						{!search && (
							<div className="flex justify-center">
								<Button onClick={() => onAction('add')}>
									New connection
								</Button>
							</div>
						)}
					</div>
				) : (
					<div className="grid min-w-0">
						{Array.from(groups).sort(([firstGroup], [secondGroup]) => Number(!firstGroup) - Number(!secondGroup)).map(([group, connections]) => {
							const items = (
								<List>
									{connections.map(server => (
										<ConnectionItem
											key={server.id}
											server={server}
											onAction={onAction}
											filtered={!!search}
										/>
									))}
								</List>
							);
							return group ? (
								<Tree key={`${group}-${!!search}`} label={group} count={connections.length} open={search ? true : undefined}>
									{items}
								</Tree>
							) : (
								<div key="ungrouped">{items}</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
