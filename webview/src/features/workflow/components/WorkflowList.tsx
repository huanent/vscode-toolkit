import { useState } from 'react';
import { cn } from 'cn';
import { ListOrdered, Play, Plus, Trash2 } from '../../../components/icons';
import { TextInput } from '../../../components/input';
import { ConnectionCard } from '../../ssh/management/main';
import type { Workflow } from '../../../../../src/features/workflow/workflow';
import { buttonClass } from './controls';

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
	return (
		<section className="py-3">
			<div className="mb-3 flex min-w-0 items-center gap-2">
				<TextInput
					className="min-w-0 flex-1"
					aria-label="Search workflows"
					placeholder="Search workflows"
					value={search}
					onChange={event => setSearch(event.target.value)}
				/>
			</div>
			<ul className="m-0 grid list-none grid-cols-1 gap-1 p-0" aria-label="Workflows">
				{workflows
					.filter(workflow => workflow.name.toLowerCase().includes(search.toLowerCase()))
					.map(workflow => (
						<ConnectionCard
							key={workflow.id}
							compact
							server={{
								id: workflow.id,
								name: workflow.name,
								address: workflow.description || `${workflow.steps.length} steps`,
								group: '',
								kind: 'Workflow',
							}}
							actions={[
								{ type: 'edit', label: 'Edit', icon: ListOrdered, disabled: locked },
								{ type: 'run', label: 'Run', icon: Play, disabled: locked },
								{ type: 'delete', label: 'Delete', icon: Trash2, disabled: locked },
							]}
							onAction={type => {
								if (locked) return;
								if (type === 'run') onRun(workflow);
								else if (type === 'delete') onDelete(workflow.id);
								else onSelect(workflow);
							}}
						/>
					))}
			</ul>
			{!loaded && <p className="text-xs">Loading...</p>}
			{loaded &&
				!workflows.some(workflow => workflow.name.toLowerCase().includes(search.toLowerCase())) && (
					<div
						role="status"
						className="py-6 text-center text-xs text-(--vscode-descriptionForeground)"
					>
						{search ? 'No matching workflows.' : 'No workflows yet.'}
						{!search && (
							<button
								type="button"
								className={cn(buttonClass, 'mx-auto mt-3 flex text-(--vscode-textLink-foreground)')}
								disabled={locked}
								onClick={onCreate}
							>
								<Plus size={16} /> New Workflow
							</button>
						)}
					</div>
				)}
			{error && (
				<p role="alert" className="text-xs text-(--vscode-errorForeground)">
					{error}
				</p>
			)}
		</section>
	);
}
