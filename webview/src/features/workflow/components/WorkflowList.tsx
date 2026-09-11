import { useState } from 'react';
import { ListOrdered, Trash2 } from '../../../components/icons';
import { DashboardEmpty, DashboardSearch } from '../../dashboard/components';
import { ConnectionCard } from '../../../components/ConnectionCard';
import type { Workflow } from '../../../../../src/features/workflow/workflow';

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
			<ul className="m-0 grid list-none grid-cols-1 gap-1 p-0" aria-label="Workflows">
				{filtered.map(workflow => (
					<ConnectionCard
						key={workflow.id}
						selected={selectedId === workflow.id}
						onSelect={setSelectedId}
						compact
						disabled={locked}
						primaryActionLabel="Run"
						server={{
							id: workflow.id,
							name: workflow.name,
							address: workflow.description || `${workflow.steps.length} steps`,
							group: '',
							kind: 'Workflow',
						}}
						actions={[
							{ type: 'edit', label: 'Edit', icon: ListOrdered, disabled: locked },
							{ type: 'delete', label: 'Delete', icon: Trash2, disabled: locked },
						]}
						onAction={type => {
							if (locked) return;
							if (type === 'connect') onRun(workflow);
							else if (type === 'delete') onDelete(workflow.id);
							else if (type === 'edit') onSelect(workflow);
						}}
					/>
				))}
			</ul>
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
