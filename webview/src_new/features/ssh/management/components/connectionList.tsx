import { useState } from 'react';
import { IconButton, Button } from '../../../../components/button';
import { Empty } from '../../../../components/empty';
import {
	Download,
	Upload,
	Plus,
	RefreshCw,
	Search,
	Terminal,
} from '../../../../components/icons';
import { Input } from '../../../../components/input';
import { List } from '../../../../components/list';
import { ConnectionItem, type Connection } from './connectionItem';
import { ConnectionGroup } from './connectionGroup';

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
	const [selectedId, setSelectedId] = useState<string>();
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
		<div className="grid min-w-0 gap-3">
			<header className="flex min-w-0 flex-wrap items-center justify-between gap-2">
				<h1 className="m-0 min-w-0 text-base font-semibold wrap-anywhere">
					{state?.name ?? 'SSH'}
					{state && (
						<span className="ml-2 text-xs font-normal text-(--vscode-descriptionForeground)">
							{servers.length}
						</span>
					)}
				</h1>
				<div className="flex items-center gap-0.5">
					<IconButton
						icon={<Upload />}
						label="Import connections"
						onClick={() => onAction('import')}
					/>
					<IconButton
						icon={<Download />}
						label="Export connections"
						disabled={!state?.servers.length}
						onClick={() => onAction('exportAll')}
					/>
					<IconButton icon={<RefreshCw />} label="Refresh" onClick={() => onAction('refresh')} />
					<IconButton icon={<Plus />} label="New connection" onClick={() => onAction('add')} />
				</div>
			</header>
			<Input
				left={<Search />}
				type="search"
				aria-label="Search connections"
				placeholder="Search connections"
				value={query}
				onChange={event => onQueryChange(event.target.value)}
			/>
			{!state ? (
				<Empty
					icon={<RefreshCw className="codicon-modifier-spin" />}
					title="Loading connections"
					role="status"
				/>
			) : servers.length === 0 ? (
				<div>
					<Empty
						icon={<Terminal />}
						title={search ? 'No matching connections' : 'No connections'}
					/>
					<div className="flex justify-center">
						<Button onClick={() => (search ? onQueryChange('') : onAction('add'))}>
							{search ? 'Clear search' : 'New connection'}
						</Button>
					</div>
				</div>
			) : (
				<div className="grid min-w-0">
				{Array.from(groups, ([group, connections]) => {
					const items = (
						<List>
							{connections.map(server => (
								<ConnectionItem
									key={server.id}
									server={server}
									selected={selectedId === server.id}
									onSelect={setSelectedId}
									onAction={onAction}
									filtered={!!search}
								/>
							))}
						</List>
					);
					return group ? (
						<ConnectionGroup key={`${group}-${!!search}`} name={group} count={connections.length}
							filtered={!!search} onAction={onAction}
							first={group === Array.from(groups.keys()).filter(Boolean)[0]}
							last={group === Array.from(groups.keys()).filter(Boolean).at(-1)}>
							{items}
						</ConnectionGroup>
					) : (
						<div key="ungrouped">{items}</div>
					);
				})}
				</div>
			)}
		</div>
	);
}
