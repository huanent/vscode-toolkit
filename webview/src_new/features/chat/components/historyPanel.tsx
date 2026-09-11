import { Search, X, MessageSquare, MessageCircle, Trash2 } from '../../../components/icons';
import { cn } from 'cn';
import { useEffect, useState, type UIEvent } from 'react';
import type { SessionItem } from '../types';
import { Empty } from '../../../components/empty';
import { Button, IconButton } from '../../../components/button';
import { Input } from '../../../components/input';

const pageSize = 30;

type HistoryPanelProps = {
	sessions: SessionItem[];
	currentSessionId?: string;
	query: string;
	onQueryChange(query: string): void;
	onClose(): void;
	onSelect(sessionId: string): void;
	onDelete(sessionId: string): void;
};

export function HistoryPanel({
	sessions,
	currentSessionId,
	query,
	onQueryChange,
	onClose,
	onSelect,
	onDelete,
}: HistoryPanelProps) {
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const filtered = normalizedQuery
		? sessions.filter(session => session.summary.toLocaleLowerCase().includes(normalizedQuery))
		: sessions;
	const [visibleCount, setVisibleCount] = useState(pageSize);
	const visibleSessions = filtered.slice(0, visibleCount);
	useEffect(() => {
		setVisibleCount(pageSize);
	}, [normalizedQuery]);
	const loadNextPage = (event: UIEvent<HTMLUListElement>) => {
		const list = event.currentTarget;
		if (
			visibleCount < filtered.length &&
			list.scrollTop + list.clientHeight >= list.scrollHeight - 32
		)
			setVisibleCount(current => Math.min(current + pageSize, filtered.length));
	};
	return (
		<aside
			className="grid max-h-[min(500px,calc(100dvh-56px))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden"
			aria-label="Chat history"
		>
			<div className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-(--vscode-widget-border,var(--vscode-panel-border)) p-2">
					<Input
						left={<Search size="sm" />}
						variant="plain"
						type="search"
						value={query}
						onChange={event => onQueryChange(event.target.value)}
						placeholder="Search history"
						aria-label="Search history"
					/>
				<IconButton
					label="Close chat history"
					title="Close history"
					icon={
						<X size="sm" />
					}
					size="md"
					onClick={onClose}
				/>
			</div>
			<ul className="m-0 min-h-0 list-none overflow-y-auto p-2" onScroll={loadNextPage}>
				{filtered.length === 0 && (
					<li>
						<Empty
							icon={
								normalizedQuery ? (
									<Search size="lg" />
								) : (
									<MessageSquare size="lg" />
								)
							}
							title={normalizedQuery ? 'No matching chats' : 'No chats yet'}
							description={
								normalizedQuery ? 'Try a different keyword.' : 'Your recent chats will appear here.'
							}
							className="min-h-40 gap-2 p-4 text-xs text-(--vscode-descriptionForeground)"
							titleClassName="text-sm text-(--vscode-foreground)"
						/>
					</li>
				)}
				{groupSessions(visibleSessions).map(group => (
					<li key={group.label}>
						<div className="px-2 pt-3 pb-2 text-xs font-medium wrap-anywhere text-(--vscode-descriptionForeground)">
							{group.label}
						</div>
						<ul className="m-0 list-none p-0">
							{group.items.map(session => (
								<li
									className={cn(
										'group grid grid-cols-[minmax(0,1fr)_32px] items-center rounded p-1',
										session.id === currentSessionId
											? 'bg-(--vscode-list-hoverBackground) text-(--vscode-list-activeSelectionForeground)'
											: 'hover:bg-(--vscode-list-activeSelectionBackground)',
									)}
									key={session.id}
								>
									<Button variant="text"
										className="min-w-0 justify-start text-left text-inherit"
										left={<MessageCircle size="sm" />}
										onClick={() => onSelect(session.id)}
									>
										<span className="block truncate">
											{session.summary}
										</span>
									</Button>
									<IconButton
										label="Delete chat"
										icon={
											<Trash2 size="sm" />
										}
										size="md"
										className={cn(
											'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
											session.id === currentSessionId && 'opacity-100',
										)}
										onClick={() => onDelete(session.id)}
									/>
								</li>
							))}
						</ul>
					</li>
				))}
			</ul>
		</aside>
	);
}

function groupSessions(sessions: SessionItem[]) {
	const groups = new Map<string, SessionItem[]>();
	for (const session of sessions) {
		const label = getSessionGroup(session.updatedAt);
		groups.set(label, [...(groups.get(label) ?? []), session]);
	}
	return [...groups].map(([label, items]) => ({ label, items }));
}

function getSessionGroup(updatedAt: number): string {
	const date = new Date(updatedAt);
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const daysAgo = Math.round((today.getTime() - sessionDay.getTime()) / 86_400_000);
	if (daysAgo <= 0) return 'Today';
	if (daysAgo === 1) return 'Yesterday';
	if (daysAgo <= 3) return 'Previous 3 days';
	if (daysAgo <= 7) return 'Previous 7 days';
	return 'Older';
}
