import { useState } from 'react';
import { CircuitBoard, Play } from '@webview/components/ui/icons';
import { IconButton } from '@webview/components/ui/button';
import { List, ListItem } from '@webview/components/ui/list';
import { DashboardEmpty, DashboardSearch } from '@webview/dashboard/components';
import type { Workflow } from '@/workflow/workflow';

type Props = {
	workflows: Workflow[];
	loaded: boolean;
	error: string;
	onRun: (workflow: Workflow) => void;
	onCreate: () => void;
};

export function WorkflowList({
	workflows,
	loaded,
	error,
	onRun,
	onCreate,
}: Props) {
	const [search, setSearch] = useState('');
	const [selectedId, setSelectedId] = useState<string>();
	const filtered = workflows.filter(workflow =>
		`${workflow.name} ${workflow.description}`.toLowerCase().includes(search.trim().toLowerCase()),
	);
	return (
		<section className="flex h-full min-h-0 flex-col">
			<div className="shrink-0">
				<DashboardSearch label="Search workflows" value={search} onChange={setSearch} />
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<List aria-label="Workflows">
					{filtered.map(workflow => (
						<ListItem
							key={workflow.id}
							selected={selectedId === workflow.id}
							onSelect={() => setSelectedId(workflow.id)}
							data-vscode-context={JSON.stringify({
								webviewSection: 'workflowItem',
								workflowId: workflow.id,
								preventDefaultContextMenuItems: true,
							})}
							onContextMenu={() => setSelectedId(workflow.id)}
							icon={<CircuitBoard />}
							description={workflow.description || `${workflow.steps.length} steps`}
							actions={<>
								<IconButton icon={<Play />} label="Run" onClick={() => onRun(workflow)} />
							</>}
						>{workflow.name}</ListItem>
					))}
				</List>
				{(!loaded || filtered.length === 0) && (
					<DashboardEmpty
						loading={!loaded}
						filtered={!!search.trim()}
						noun="workflows"
						onCreate={onCreate}
						onClear={() => setSearch('')}
					/>
				)}
				{error && (
					<p role="alert" className="text-xs text-(--vscode-errorForeground)">
						{error}
					</p>
				)}
			</div>
		</section>
	);
}
