import { useEffect, useState } from 'react';
import type { Workflow } from '@/workflow/workflow';
import { Plus, RefreshCw } from '@webview/components/ui/icons';
import { IconButton } from '@webview/components/ui/button';
import { Toolbar } from '@webview/components/ui/toolbar';
import { workflowApi, subscribe } from '../vscode';
import { WorkflowList } from './components/workflowList';

export function Workflows() {
	const [state, setState] = useState<{ workflows: Workflow[] }>();
	const [error, setError] = useState('');
	const refresh = () => workflowApi.postMessage({ type: 'ready' });
	const open = (workflow: Workflow) => workflowApi.postMessage({ type: 'openEditor', workflow });
	const create = () => open({ id: crypto.randomUUID(), name: 'New Workflow', steps: [] });
	useEffect(() => {
		const unsubscribe = subscribe(event => {
			if (event.data.type === 'state') setState(event.data);
			if (event.data.type === 'error') setError(event.data.message);
		});
		refresh();
		return unsubscribe;
	}, []);
	useEffect(() => {
		const receive = (event: Event) => {
			const detail = (event as CustomEvent).detail;
			const workflow = state?.workflows.find(item => item.id === detail.id);
			if (detail.tab === 'workflow' && workflow) open(workflow);
		};
		window.addEventListener('dashboardOpenItem', receive);
		return () => window.removeEventListener('dashboardOpenItem', receive);
	}, [state]);
	return (
		<div className="flex h-full min-h-0 min-w-0 flex-col py-2 text-(--vscode-foreground)">
			<Toolbar title="Workflow">
				<IconButton label="Refresh workflows" icon={<RefreshCw />} onClick={refresh} />
				<IconButton label="New workflow" icon={<Plus />} onClick={create} />
			</Toolbar>
			<div className="min-h-0 flex-1">
				<WorkflowList
					workflows={state?.workflows ?? []}
					loaded={state !== undefined}
					error={error}
					onRun={workflow => workflowApi.postMessage({ type: 'run', workflow })}
					onCreate={create}
				/>
			</div>
		</div>
	);
}