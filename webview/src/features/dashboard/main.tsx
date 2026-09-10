import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
	CircuitBoard,
	Database,
	Folder,
	Globe,
	MessageSquare,
	Container,
	Rocket,
	Terminal,
} from '../../components/icons';
import { cn } from 'cn';
import { vscode } from '../../vscodeApi';
import { Connections } from '../ssh/management/main';
import { App as Workflow } from '../workflow/main';
import { App as Launchd } from '../launchd/App';
import { type Tab } from './channel';

document.body.classList.add('min-w-0');
const tabs = [
	{ id: 'workflow', label: 'Workflow', icon: CircuitBoard },
	{ id: 'ssh', label: 'SSH', icon: Terminal },
	{ id: 'database', label: 'Database', icon: Database },
	{ id: 'container', label: 'Container', icon: Container },
	{ id: 'launchd', label: 'Launchd', icon: Rocket },
] as const;
function App() {
	const [active, setActive] = useState<Tab>('workflow');
	const [connected, setConnected] = useState(false);
	const [isMac, setIsMac] = useState(false);
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === 'dashboardState') {
				setActive(message.tab);
				setIsMac(message.isMac);
			}
			if (message.type === 'dashboardTab') setActive(message.tab);
			if (message.type === 'dashboardConnected') setConnected(true);
		};
		window.addEventListener('message', receive);
		vscode.postMessage({ type: 'dashboardReady' });
		return () => window.removeEventListener('message', receive);
	}, []);
	const select = (tab: Tab) => {
		setActive(tab);
		vscode.postMessage({ type: 'dashboardTab', tab });
	};
	return (
		<main className="min-w-0 p-2 text-(--vscode-foreground)">
			<header className="border-b border-(--vscode-panel-border) pb-2">
				<nav aria-label="Quick navigation" className="grid grid-cols-3 gap-1">
					{[
						{ command: 'openExplorer', label: 'File Explorer', icon: Folder },
						{ command: 'openChat', label: 'Chat', icon: MessageSquare },
						{ command: 'openHttpClient', label: 'HTTP Client', icon: Globe },
					].map(({ command, label, icon: Icon }) => (
						<button
							key={command}
							className="flex min-h-10 min-w-0 flex-col items-center justify-center gap-1 rounded-xs px-1 py-1 text-xs hover:bg-(--vscode-toolbar-hoverBackground)"
							onClick={() => vscode.postMessage({ type: 'dashboardNavigate', command })}
						>
							<Icon size={15} />
							{label}
						</button>
					))}
				</nav>
			</header>
			<div
				role="tablist"
				aria-label="Tools"
				className="grid grid-cols-5 border-b border-(--vscode-panel-border)"
			>
				{tabs.map(({ id, label, icon: Icon }, index) => (
					<button
						key={id}
						id={`tab-${id}`}
						role="tab"
						title={label}
						aria-label={label}
						aria-selected={active === id}
						aria-controls={`panel-${id}`}
						tabIndex={active === id ? 0 : -1}
						className={cn(
							'flex h-9 min-w-0 items-center justify-center border-b-2 text-xs',
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
						<span className="sr-only">{label}</span>
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
							<Workflow />
						) : id === 'launchd' ? (
							isMac ? (
								<Launchd />
							) : (
								<p className="py-6 text-xs">Launchd is only available on macOS.</p>
							)
						) : (
							<Connections tab={id} />
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
