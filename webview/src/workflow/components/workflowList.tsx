import { useState } from 'react';
import { CircuitBoard, Play } from '@webview/components/ui/icons';
import { Button, IconButton } from '@webview/components/ui/button';
import { List, ListItem } from '@webview/components/ui/list';
import { Popover } from '@webview/components/ui/popover';
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
	const [menu, setMenu] = useState<{ workflow: Workflow; x: number; y: number }>();
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
						onContextMenu={event => {
							event.preventDefault();
							setSelectedId(workflow.id);
							setMenu({ workflow, x: event.clientX, y: event.clientY });
						}}
						onKeyDown={event => {
							if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
							event.preventDefault();
							const bounds = event.currentTarget.getBoundingClientRect();
							setSelectedId(workflow.id);
							setMenu({ workflow, x: bounds.left, y: bounds.bottom });
						}}
						icon={<CircuitBoard />}
						description={workflow.description || `${workflow.steps.length} steps`}
						actions={<>
							<IconButton icon={<Play />} label="Run" disabled={locked} onClick={() => onRun(workflow)} />
						</>}
					>{workflow.name}</ListItem>
				))}
			</List>
			<Popover open={!!menu} onOpenChange={open => { if (!open) setMenu(undefined); }} anchorPosition={menu} label={`Actions for ${menu?.workflow.name ?? 'workflow'}`}>
				<div className="grid min-w-40 p-1">
					<Button variant="text" className="w-full justify-start" disabled={locked} onClick={() => {
						if (!menu) return;
						setMenu(undefined);
						onSelect(menu.workflow);
					}}>Edit</Button>
					<Button variant="text" className="w-full justify-start" disabled={locked} onClick={() => {
						if (!menu) return;
						setMenu(undefined);
						onDelete(menu.workflow.id);
					}}>Delete</Button>
				</div>
			</Popover>
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
