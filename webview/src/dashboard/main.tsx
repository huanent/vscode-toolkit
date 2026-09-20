import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitBoard, Terminal } from '../components/ui/icons';
import { cn } from 'cn';
import { vscode } from '@webview/vscodeApi';
import { Connections } from '../connection/app';
import { Workflows as Workflow } from '../workflow/management/app';
import { type Tab } from './channel';
import { DashboardEmpty } from './components';

document.body.classList.add('min-w-0', 'overflow-hidden');
document.getElementById('root')!.classList.add('overflow-hidden');
const tabs = [
	{ id: 'workflow', label: 'Workflow', icon: CircuitBoard, component: Workflow },
	{ id: 'connection', label: 'Connection', icon: Terminal, component: Connections },
] as const;
function App() {
	const [active, setActive] = useState<Tab>('workflow');
	const [connected, setConnected] = useState(false);
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === 'dashboardState') {
				setActive(message.tab === 'workflow' ? 'workflow' : 'connection');
			}
			if (message.type === 'dashboardTab') setActive(message.tab === 'workflow' ? 'workflow' : 'connection');
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
		<main className="@container flex h-full min-h-0 min-w-0 flex-col overflow-hidden text-(--vscode-foreground)">
			<div
				role="tablist"
				aria-label="Tools"
				className="grid shrink-0 grid-cols-2 border-b border-(--vscode-panel-border) bg-transparent"
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
						<Icon size="md" />
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
						className="min-h-0 min-w-0 flex-1 overflow-hidden px-3"
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
