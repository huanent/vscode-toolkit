import { useState } from 'react';
import { ListOrdered, Play, Trash2 } from '@webview/components/ui/icons';
import { IconButton } from '@webview/components/ui/button';
import { List, ListItem } from '@webview/components/ui/list';
import { DashboardEmpty, DashboardSearch } from '@webview/dashboard/components';
import type { Workflow } from '../../../../src/workflow/workflow';

type Props = {
	workflows: Workflow[];
	locked: boolean;
	loaded: boolean;
	error: string;
	onSelect: (workflow: Workflow) => void;
	onRun: (workflow: Workflow) => void;
	onDelete: (id: string) => void;
	onCreate: () => void;
};

export function WorkflowList({
	workflows,
	locked,
	loaded,
	error,
	onSelect,
	onRun,
	onDelete,
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
						icon={<ListOrdered />}
						description={workflow.description || `${workflow.steps.length} steps`}
						actions={<>
							<IconButton icon={<Play />} label="Run" disabled={locked} onClick={() => onRun(workflow)} />
							<IconButton icon={<ListOrdered />} label="Edit" disabled={locked} onClick={() => onSelect(workflow)} />
							<IconButton icon={<Trash2 />} label="Delete" disabled={locked} onClick={() => onDelete(workflow.id)} />
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
