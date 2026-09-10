import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
	Database,
	FolderOpen,
	Globe,
	ListOrdered,
	MessageSquare,
	Package,
	Rocket,
	Star,
	Terminal,
	X,
} from 'lucide-react';
import { cn } from 'cn';
import { vscode } from '../../vscodeApi';
import { IconButton } from '../../components/button';
import { Connections, ConnectionCard, type Connection } from '../ssh/management/main';
import { App as Workflow } from '../workflow/main';
import { App as Launchd } from '../launchd/App';
import { send, type Tab } from './channel';

type Favorite = { tab: Tab; id: string };
const tabs = [
	{ id: 'ssh', label: 'SSH', icon: Terminal },
	{ id: 'workflow', label: 'Workflow', icon: ListOrdered },
	{ id: 'database', label: 'Database', icon: Database },
	{ id: 'container', label: 'Container', icon: Package },
	{ id: 'launchd', label: 'Launchd', icon: Rocket },
] as const;
function App() {
	const [active, setActive] = useState<Tab>('ssh');
	const [connected, setConnected] = useState(false);
	const [isMac, setIsMac] = useState(false);
	const [favorites, setFavorites] = useState<Favorite[]>([]);
	const [items, setItems] = useState<Partial<Record<Tab, Connection[]>>>({});
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === 'dashboardState') {
				setActive(message.tab);
				setFavorites(message.favorites);
				setIsMac(message.isMac);
			}
			if (message.type === 'dashboardTab') setActive(message.tab);
			if (message.type === 'dashboardConnected') setConnected(true);
			if (
				message.channel &&
				message.type === 'state' &&
				message.servers &&
				message.channel !== 'workflow'
			) {
				setItems(current => ({ ...current, [message.channel]: message.servers }));
			}
			if (message.channel === 'workflow' && message.type === 'state') {
				setItems(current => ({
					...current,
					workflow: message.workflows.map(
						(item: { id: string; name: string; description?: string; steps: unknown[] }) => ({
							id: item.id,
							name: item.name,
							address: item.description || `${item.steps.length} steps`,
							group: '',
							kind: 'Workflow',
						}),
					),
				}));
			}
			if (message.type === 'launchdAgents') {
				setItems(current => ({
					...current,
					launchd: message.agents.map(
						(item: { fileName: string; label: string; state: string }) => ({
							id: item.fileName,
							name: item.label,
							address: item.state,
							group: '',
							kind: 'Launchd',
						}),
					),
				}));
			}
		};
		window.addEventListener('message', receive);
		vscode.postMessage({ type: 'dashboardReady' });
		return () => window.removeEventListener('message', receive);
	}, []);
	const select = (tab: Tab) => {
		setActive(tab);
		vscode.postMessage({ type: 'dashboardTab', tab });
	};
	const toggle = (tab: Tab, id: string) => {
		const next = favorites.some(item => item.tab === tab && item.id === id)
			? favorites.filter(item => item.tab !== tab || item.id !== id)
			: [...favorites, { tab, id }];
		setFavorites(next);
		vscode.postMessage({ type: 'dashboardFavorites', favorites: next });
	};
	const openFavorite = (favorite: Favorite) => {
		select(favorite.tab);
		if (favorite.tab === 'workflow' || favorite.tab === 'launchd') {
			window.dispatchEvent(new CustomEvent('dashboardOpenItem', { detail: favorite }));
		} else send(favorite.tab, { type: 'connect', id: favorite.id });
	};
	return (
		<main className="mx-auto max-w-7xl p-4 text-(--vscode-foreground) max-[600px]:p-3">
			<header className="flex flex-wrap items-center gap-3 border-b border-(--vscode-panel-border) pb-4">
				<h1 className="mr-auto text-base font-semibold">Dashboard</h1>
				<nav aria-label="Quick navigation" className="flex flex-wrap gap-1">
					{[
						{ command: 'openChat', label: 'Chat', icon: MessageSquare },
						{ command: 'openExplorer', label: 'Explorer', icon: FolderOpen },
						{ command: 'openHttpClient', label: 'HTTP Client', icon: Globe },
					].map(({ command, label, icon: Icon }) => (
						<button
							key={command}
							className="flex h-8 items-center gap-2 rounded-xs px-3 text-xs hover:bg-(--vscode-toolbar-hoverBackground)"
							onClick={() => vscode.postMessage({ type: 'dashboardNavigate', command })}
						>
							<Icon size={15} />
							{label}
						</button>
					))}
				</nav>
			</header>
			<section aria-label="Favorites" className="py-4">
				<h2 className="mb-2 flex items-center gap-2 text-xs font-semibold text-(--vscode-descriptionForeground)">
					<Star size={14} />
					Favorites
				</h2>
				{favorites.length === 0 ? (
					<p className="py-3 text-xs text-(--vscode-descriptionForeground)">No favorites yet.</p>
				) : (
					<ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-2 p-0">
						{favorites.map(favorite => {
							const item = items[favorite.tab]?.find(candidate => candidate.id === favorite.id);
							return item ? (
								<ConnectionCard
									key={`${favorite.tab}:${favorite.id}`}
									server={{ ...item, address: `${item.kind} · ${item.address}` }}
									actions={[]}
									onAction={() => openFavorite(favorite)}
									favorite
									onFavorite={() => toggle(favorite.tab, favorite.id)}
								/>
							) : (
								<li
									key={`${favorite.tab}:${favorite.id}`}
									className="flex min-w-0 items-center gap-2 rounded-sm border border-(--vscode-panel-border) p-2 text-xs"
								>
									<span className="min-w-0 flex-1 truncate">
										{items[favorite.tab] ? 'Unavailable item' : 'Loading...'} ({favorite.tab})
									</span>
									<IconButton
										title="Remove favorite"
										aria-label="Remove unavailable favorite"
										onClick={() => toggle(favorite.tab, favorite.id)}
									>
										<X size={14} />
									</IconButton>
								</li>
							);
						})}
					</ul>
				)}
			</section>
			<div
				role="tablist"
				aria-label="Tools"
				className="flex overflow-x-auto border-b border-(--vscode-panel-border)"
			>
				{tabs.map(({ id, label, icon: Icon }, index) => (
					<button
						key={id}
						id={`tab-${id}`}
						role="tab"
						aria-selected={active === id}
						aria-controls={`panel-${id}`}
						tabIndex={active === id ? 0 : -1}
						className={cn(
							'flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-xs',
							active === id
								? 'border-(--vscode-focusBorder) text-(--vscode-foreground)'
								: 'border-transparent text-(--vscode-descriptionForeground) hover:bg-(--vscode-toolbar-hoverBackground)',
						)}
						onClick={() => select(id)}
						onKeyDown={event => {
							const next =
								event.key === 'ArrowRight'
									? (index + 1) % tabs.length
									: event.key === 'ArrowLeft'
										? (index + tabs.length - 1) % tabs.length
										: event.key === 'Home'
											? 0
											: event.key === 'End'
												? tabs.length - 1
												: undefined;
							if (next !== undefined) {
								event.preventDefault();
								select(tabs[next].id);
								document.getElementById(`tab-${tabs[next].id}`)?.focus();
							}
						}}
					>
						<Icon size={15} />
						{label}
					</button>
				))}
			</div>
			{connected ? (
				tabs.map(({ id }) => (
					<div
						key={id}
						id={`panel-${id}`}
						role="tabpanel"
						aria-labelledby={`tab-${id}`}
						hidden={active !== id}
					>
						{id === 'workflow' ? (
							<Workflow
								favorites={favorites.filter(item => item.tab === id).map(item => item.id)}
								onFavorite={itemId => toggle(id, itemId)}
							/>
						) : id === 'launchd' ? (
							isMac ? (
								<Launchd
									favorites={favorites.filter(item => item.tab === id).map(item => item.id)}
									onFavorite={itemId => toggle(id, itemId)}
								/>
							) : (
								<p className="py-6 text-xs">Launchd is only available on macOS.</p>
							)
						) : (
							<Connections
								tab={id}
								favorites={favorites.filter(item => item.tab === id).map(item => item.id)}
								onFavorite={itemId => toggle(id, itemId)}
							/>
						)}
					</div>
				))
			) : (
				<p role="status" className="py-6 text-xs">
					Loading...
				</p>
			)}
		</main>
	);
}
createRoot(document.getElementById('root')!).render(<App />);
