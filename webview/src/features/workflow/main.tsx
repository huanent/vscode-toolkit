import { cn } from 'cn';
import { ListOrdered, Plus, RefreshCw } from '../../components/icons';
import { IconButton } from './components/controls';
import { WorkflowEditor } from './components/WorkflowEditor';
import { WorkflowList } from './components/WorkflowList';
import { useWorkflow } from './hooks/useWorkflow';

export function App() {
	const editorMode = document.body.dataset.toolkitEditor === 'true';
	const controller = useWorkflow(editorMode);
	return (
		<div
			className={cn(
				'flex min-w-0 flex-col text-(--vscode-foreground)',
				editorMode ? 'mx-auto max-w-240 px-3 py-4 sm:px-6' : 'py-3',
			)}
		>
			<header className="flex min-h-9 flex-wrap items-center gap-2 border-b border-(--vscode-panel-border) pb-2">
				<ListOrdered size={18} />
				<h1 className="text-sm font-semibold">Workflow</h1>
				{!editorMode && (
					<div className="ml-auto flex items-center gap-1">
						<IconButton
							title="Refresh workflows"
							disabled={controller.locked}
							onClick={controller.refresh}
						>
							<RefreshCw size={16} />
						</IconButton>
						<IconButton
							title="New workflow"
							disabled={controller.locked}
							onClick={controller.create}
						>
							<Plus size={16} />
						</IconButton>
					</div>
				)}
			</header>
			<div>
				<div hidden={editorMode}>
					<WorkflowList
						workflows={controller.state.workflows}
						locked={controller.locked}
						loaded={controller.loaded}
						error={controller.draft ? '' : controller.error}
						onSelect={controller.select}
						onRun={controller.run}
						onDelete={controller.remove}
						onCreate={controller.create}
					/>
				</div>
				<WorkflowEditor controller={controller} />
			</div>
		</div>
	);
}
