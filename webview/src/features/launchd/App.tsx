import { cn } from 'cn';
import { FolderOpen, Plus, RefreshCw, Rocket } from 'lucide-react';
import { IconButton, PageHeading, PrimaryButton } from '../../components';
import { vscode } from '../../vscodeApi';
import { AgentEditor } from './components/AgentEditor';
import { AgentList } from './components/AgentList';
import { LaunchdDetails } from './components/LaunchdDetails';
import { useLaunchd } from './hooks/useLaunchd';

export function App() {
	const launchd = useLaunchd();
	return (
		<main className="mx-auto w-[min(1220px,calc(100%-40px))] py-6 pb-10 max-[760px]:w-[calc(100%-20px)] max-[760px]:pt-4">
			<PageHeading
				icon={<Rocket size={22} aria-hidden="true" />}
				title="Launchd"
				description="Manage per-user background services in ~/Library/LaunchAgents."
				accentClassName="text-(--vscode-charts-green)"
				actions={
					<div className="flex shrink-0 items-center gap-2">
						<IconButton
							type="button"
							title="Open LaunchAgents folder"
							aria-label="Open LaunchAgents folder"
							onClick={() => vscode.postMessage({ type: 'openDirectory' })}
						>
							<FolderOpen size={17} />
						</IconButton>
						<IconButton
							type="button"
							title="Refresh status"
							aria-label="Refresh status"
							disabled={launchd.busy}
							onClick={() => launchd.runAction({ type: 'refresh' })}
						>
							<RefreshCw className={cn(launchd.busy && 'animate-spin')} size={17} />
						</IconButton>
						<PrimaryButton
							className="max-[760px]:size-8.5 max-[760px]:px-0"
							type="button"
							aria-label="New agent"
							onClick={launchd.createNew}
						>
							<Plus size={16} />
							<span className="max-[760px]:hidden">New agent</span>
						</PrimaryButton>
					</div>
				}
			/>

			{launchd.error && <Message kind="error">{launchd.error}</Message>}
			{launchd.notice && <Message kind="success">{launchd.notice}</Message>}

			<div className="grid min-h-155 grid-cols-[minmax(260px,31%)_minmax(0,1fr)] overflow-hidden rounded-[4px] border border-(--vscode-panel-border) bg-(--vscode-editor-background) shadow-sm max-[760px]:grid-cols-1">
				<AgentList
					agents={launchd.agents}
					selectedFileName={launchd.selectedFileName}
					busy={launchd.busy}
					detailsLoading={launchd.detailsLoading}
					onSelect={launchd.selectAgent}
					onAction={launchd.runAction}
					onDetails={launchd.showDetails}
					onRemove={launchd.remove}
				/>
				<AgentEditor
					draft={launchd.draft}
					argumentsText={launchd.argumentsText}
					environmentText={launchd.environmentText}
					busy={launchd.busy}
					onArgumentsChange={launchd.setArgumentsText}
					onEnvironmentChange={launchd.setEnvironmentText}
					onUpdate={launchd.update}
					onSave={launchd.save}
				/>
			</div>

			{(launchd.detailsLoading || launchd.details) && (
				<LaunchdDetails
					loading={launchd.detailsLoading}
					details={launchd.details}
					onClose={launchd.closeDetails}
				/>
			)}
		</main>
	);
}

function Message({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
	const kindClassName =
		kind === 'error'
			? 'border-(--vscode-errorForeground) bg-(--vscode-inputValidation-errorBackground) text-(--vscode-errorForeground)'
			: 'border-(--vscode-testing-iconPassed) bg-(--vscode-editorWidget-background)';
	return (
		<div
			className={cn(
				'mb-3.5 rounded-[2px] border border-l-[3px] px-3 py-2.5 text-xs',
				kindClassName,
			)}
			role={kind === 'error' ? 'alert' : 'status'}
		>
			{children}
		</div>
	);
}
