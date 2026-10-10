import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitBoard, Terminal, History } from '@/webview/components/icons';
import { vscode } from '@/webview/vscodeApi';
import { Connections } from '../connection/app';
import { Workflows as Workflow } from '../workflow/management/app';
import { type Tab } from './channel';
import { Loading } from '@/webview/components/loading';
import { Temp } from '../temp/app';
import { Tabs, TabPanel } from '@/webview/components/tabs';

document.body.classList.add('min-w-0', 'overflow-hidden');
document.getElementById('root')!.classList.add('overflow-hidden');
const tabs = [
	{ id: 'workflow', label: 'Workflow', icon: <CircuitBoard size="md" />, component: Workflow },
	{ id: 'connection', label: 'Connection', icon: <Terminal size="md" />, component: Connections },
	{ id: 'temp', label: 'Temp', icon: <History size="md" />, component: Temp },
] as const;
function App() {
	const [active, setActive] = useState<Tab>('workflow');
	const [connected, setConnected] = useState(false);
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === 'dashboardState' || message.type === 'dashboardTab') {
				if (tabs.some(tab => tab.id === message.tab)) setActive(message.tab);
			}
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
		<main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden text-(--vscode-foreground)">
			<Tabs tabs={tabs} activeTabId={active} onChange={select} ariaLabel="Tools" className="h-full">
				{connected ? (
					tabs.map(({ id, component: Feature }) => (
						<TabPanel key={id} tabId={id} className="h-full overflow-hidden px-3">
							<Feature />
						</TabPanel>
					))
				) : (
					<Loading />
				)}
			</Tabs>
		</main>
	);
}
createRoot(document.getElementById('root')!).render(<App />);
