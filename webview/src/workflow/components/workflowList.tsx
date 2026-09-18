import { useState } from 'react';
import { CircuitBoard, Play } from '@webview/components/ui/icons';
import { IconButton } from '@webview/components/ui/button';
import { List, ListItem } from '@webview/components/ui/list';
import { DashboardEmpty, DashboardSearch } from '@webview/dashboard/components';
import type { Workflow } from '../../../../src/workflow/workflow';

type Props = {
	workflows: Workflow[];
	locked: boolean;
	loaded: boolean;
	error: string;
	onRun: (workflow: Workflow) => void;
	onCreate: () => void;
};

export function WorkflowList({
	workflows,
	locked,
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
		<section>
			<DashboardSearch label="Search workflows" value={search} onChange={setSearch} />
			<List aria-label="Workflows">
				{filtered.map(workflow => (
					<ListItem
						key={workflow.id}
						selected={selectedId === workflow.id}
						onSelect={() => setSelectedId(workflow.id)}
						data-vscode-context={JSON.stringify({
							webviewSection: 'workflowItem',
							workflowId: workflow.id,
							workflowLocked: locked,
							preventDefaultContextMenuItems: true,
						})}
						onContextMenu={() => setSelectedId(workflow.id)}
						icon={<CircuitBoard />}
						description={workflow.description || `${workflow.steps.length} steps`}
						actions={<>
							<IconButton icon={<Play />} label="Run" disabled={locked} onClick={() => onRun(workflow)} />
						</>}
					>{workflow.name}</ListItem>
				))}
			</List>
			{(!loaded || filtered.length === 0) && (
				<DashboardEmpty
					loading={!loaded}
					filtered={!!search.trim()}
					noun="workflows"
					disabled={locked}
					onCreate={onCreate}
					onClear={() => setSearch('')}
				/>
			)}
			{error && (
				<p role="alert" className="text-xs text-(--vscode-errorForeground)">
					{error}
				</p>
			)}
		</section>
	);
}
