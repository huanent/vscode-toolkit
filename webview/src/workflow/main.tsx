import { cn } from 'cn';
import { Plus, RefreshCw } from '@webview/components/ui/icons';
import { IconButton } from '@webview/components/ui/button';
import { DashboardHeader } from '@webview/dashboard/components';
import { WorkflowEditor } from './components/workflowEditor';
import { WorkflowList } from './components/workflowList';
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
			<DashboardHeader
				title="Workflow"
				count={!editorMode && controller.loaded ? controller.state.workflows.length : undefined}
			>
				{!editorMode && (
					<div className="flex items-center gap-0.5">
						<IconButton label="Refresh workflows" icon={<><RefreshCw size="md" /></>}
							title="Refresh workflows"
							aria-label="Refresh workflows"
							disabled={controller.locked}
							onClick={controller.refresh}
						></IconButton>
						<IconButton label="New workflow" icon={<><Plus size="md" /></>}
							title="New workflow"
							aria-label="New workflow"
							disabled={controller.locked}
							onClick={controller.create}
						></IconButton>
					</div>
				)}
			</DashboardHeader>
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
