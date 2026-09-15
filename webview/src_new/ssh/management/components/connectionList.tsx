import { useState } from 'react';
import { IconButton, Button } from '../../../components/ui/button';
import { Empty } from '../../../components/ui/empty';
import {
	MoreHorizontal,
	Plus,
	RefreshCw,
	Search,
	X,
} from '../../../components/ui/icons';
import { Input } from '../../../components/ui/input';
import { List } from '../../../components/ui/list';
import { Popover } from '../../../components/ui/popover';
import { ConnectionItem, type Connection } from './connectionItem';
import { ConnectionGroupNode } from './connectionGroupNode';

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
	const [moreOpen, setMoreOpen] = useState(false);
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
		<div className="grid min-w-0 gap-2">
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
					<IconButton icon={<RefreshCw />} label="Refresh" onClick={() => onAction('refresh')} />
					<IconButton icon={<Plus />} label="New connection" onClick={() => onAction('add')} />
					<Popover
						open={moreOpen}
						onOpenChange={setMoreOpen}
						label="More connection actions"
						placement="bottom-end"
						trigger={props => <IconButton {...props} icon={<MoreHorizontal />} label="More actions" />}
					>
						<div className="grid min-w-40 p-1">
							{[
								{ type: 'import', label: 'Import', disabled: false },
								{ type: 'exportAll', label: 'Export', disabled: !state?.servers.length },
							].map(action => (
								<Button
									key={action.type}
									variant="text"
									disabled={action.disabled}
									className="w-full justify-start"
									onClick={() => {
										setMoreOpen(false);
										onAction(action.type);
									}}
								>
									{action.label}
								</Button>
							))}
						</div>
					</Popover>
				</div>
			</header>
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
							<ConnectionGroupNode key={`${group}-${!!search}`} name={group} count={connections.length}
								filtered={!!search} onAction={onAction}
								first={group === Array.from(groups.keys()).filter(Boolean)[0]}
								last={group === Array.from(groups.keys()).filter(Boolean).at(-1)}>
								{items}
							</ConnectionGroupNode>
						) : (
							<div key="ungrouped">{items}</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
