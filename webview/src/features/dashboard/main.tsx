import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitBoard, Database, Container, Terminal } from '../../components/icons';
import { cn } from 'cn';
import { vscode } from '../../vscodeApi';
import { SshConnections } from '../ssh/management/main';
import { DatabaseConnections } from '../database/management/main';
import { ContainerConnections } from '../container/management/main';
import { App as Workflow } from '../workflow/main';
import { type Tab } from './channel';
import { DashboardEmpty } from './components';

document.body.classList.add('min-w-0');
const tabs = [
	{ id: 'workflow', label: 'Workflow', icon: CircuitBoard, component: Workflow },
	{ id: 'ssh', label: 'SSH', icon: Terminal, component: SshConnections },
	{ id: 'database', label: 'Database', icon: Database, component: DatabaseConnections },
	{ id: 'container', label: 'Container', icon: Container, component: ContainerConnections },
] as const;
function App() {
	const [active, setActive] = useState<Tab>('workflow');
	const [connected, setConnected] = useState(false);
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === 'dashboardState') {
				setActive(message.tab);
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
		<main className="@container min-w-0 text-(--vscode-foreground)">
			<div
				role="tablist"
				aria-label="Tools"
				className="sticky top-0 z-10 grid grid-cols-4 border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background,var(--vscode-editor-background))"
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
							'flex h-10 min-w-0 items-center justify-center gap-1.5 border-b-2 px-1 text-xs focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-(--vscode-focusBorder)',
							active === id
								? 'border-(--vscode-focusBorder) text-(--vscode-foreground)'
								: 'border-transparent text-(--vscode-descriptionForeground)',
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
						<span className="hidden truncate @min-[360px]:inline">{label}</span>
					</button>
				))}
			</div>
			{connected ? (
				tabs.map(({ id, component: Feature }) => (
					<div
						key={id}
						id={`panel-${id}`}
						role="tabpanel"
						aria-labelledby={`tab-${id}`}
						className="min-w-0 px-3"
						hidden={active !== id}
					>
						<Feature />
					</div>
				))
			) : (
				<DashboardEmpty loading noun="connections" />
			)}
		</main>
	);
}
createRoot(document.getElementById('root')!).render(<App />);
