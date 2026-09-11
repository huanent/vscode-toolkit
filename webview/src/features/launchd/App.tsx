import { cn } from 'cn';
import { useEffect, useState } from 'react';
import { FolderOpen, Plus, RefreshCw, Play, Square, Info, Pencil, Trash2 } from '../../components/icons';
import { IconButton, PrimaryButton } from '../../components';
import { launchdApi as vscode } from '../dashboard/channel';
import { ConnectionCard } from '../../components/ConnectionCard';
import { ConnectionGroup } from '../../components/ConnectionGroup';
import { Dialog } from '../../components/dialog';
import { AgentEditor } from './components/AgentEditor';
import { LaunchdDetails } from './components/LaunchdDetails';
import { useLaunchd } from './hooks/useLaunchd';
import type { LaunchAgent } from './types';

export function App() {
	const [editRequest, setEditRequest] = useState<{
		type: string;
		agent?: LaunchAgent;
		id?: string;
		label?: string;
	}>();
	const launchd = useLaunchd();
	const [query, setQuery] = useState('');
	const [editing, setEditing] = useState(false);
	const [dirty, setDirty] = useState(false);
	useEffect(() => {
		const edit = (event: Event) => setEditRequest((event as CustomEvent).detail);
		window.addEventListener('toolkitEdit', edit);
		return () => window.removeEventListener('toolkitEdit', edit);
	}, []);
	useEffect(() => {
		if (!editRequest || launchd.busy) return;
		if (dirty && !window.confirm('Discard unsaved changes?')) {
			setEditRequest(undefined);
			return;
		}
		const agent =
			editRequest.agent ??
			launchd.agents.find(
				item => item.fileName === editRequest.id || item.label === editRequest.label,
			);
		if (editRequest.type === 'details' && agent) {
			launchd.showDetails(agent);
			setEditing(false);
		} else if (agent || editRequest.type === 'add') {
			if (agent) launchd.selectAgent(agent);
			else launchd.createNew();
			setEditing(true);
			setDirty(false);
		}
		setEditRequest(undefined);
	}, [editRequest, launchd.busy, launchd.agents]);
	useEffect(() => {
		const open = (event: Event) => {
			const detail = (event as CustomEvent).detail;
			const agent = launchd.agents.find(item => item.fileName === detail.id);
			if (detail.tab !== 'launchd' || !agent || launchd.busy) return;
			if (dirty && !window.confirm('Discard unsaved changes?')) return;
			launchd.selectAgent(agent);
			setEditing(true);
			setDirty(false);
		};
		window.addEventListener('dashboardOpenItem', open);
		return () => window.removeEventListener('dashboardOpenItem', open);
	}, [launchd.agents, launchd.busy, dirty]);
	const agents = launchd.agents.filter(agent =>
		`${agent.label} ${agent.program} ${agent.state}`.toLowerCase().includes(query.toLowerCase()),
	);
	return (
		<section className="py-4">
			<header className="mb-2 flex flex-wrap items-center gap-1">
				<h2 className="mr-auto text-sm font-semibold">Launchd</h2>
				<input
					aria-label="Search agents"
					placeholder="Search agents"
					className="order-last h-8 w-full min-w-0 rounded-xs bg-(--vscode-input-background) px-2 text-xs text-(--vscode-input-foreground)"
					value={query}
					onChange={event => setQuery(event.target.value)}
				/>
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
						<RefreshCw className={cn(launchd.busy && 'codicon-modifier-spin')} size={17} />
					</IconButton>
					<PrimaryButton
						className="max-[760px]:size-8.5 max-[760px]:px-0"
						type="button"
						aria-label="New agent"
						disabled={launchd.busy}
						onClick={() => {
							setEditRequest({ type: 'add' });
						}}
					>
						<Plus size={16} />
						<span className="max-[760px]:hidden">New agent</span>
					</PrimaryButton>
				</div>
			</header>

			{launchd.error && <Message kind="error">{launchd.error}</Message>}
			{launchd.notice && <Message kind="success">{launchd.notice}</Message>}

			{launchd.busy && (
				<p role="status" className="text-xs">
					Loading...
				</p>
			)}
			{!launchd.busy && !agents.length && (
				<p role="status" className="py-6 text-center text-xs text-(--vscode-descriptionForeground)">
					{query ? 'No matching agents.' : 'No agents yet.'}
				</p>
			)}
			{['running', 'loaded', 'unloaded', 'error'].map(state => {
					const group = agents.filter(agent => agent.state === state);
					return (
						group.length > 0 && (
							<ConnectionGroup key={state} name={state} count={group.length}>
									{group.map(agent => (
										<ConnectionCard
											key={agent.fileName}
											compact
											server={{
												id: agent.fileName,
												name: agent.label,
												address: agent.program || agent.programArguments[0] || agent.fileName,
												group: state,
												kind: 'Launchd',
											}}
											actions={[
												{ type: 'edit', label: 'Edit', icon: Pencil, disabled: launchd.busy },
												{
													type: 'start',
													label: 'Start',
													icon: Play,
													disabled: launchd.busy || state === 'running',
												},
												{
													type: 'stop',
													label: 'Stop',
													icon: Square,
													disabled: launchd.busy || state === 'unloaded',
												},
												{
													type: 'details',
													label: 'Details',
													icon: Info,
													disabled: launchd.detailsLoading,
												},
												{ type: 'delete', label: 'Delete', icon: Trash2, disabled: launchd.busy },
											]}
											onAction={type => {
												if (launchd.busy) return;
												if (type === 'connect' || type === 'edit') {
													setEditRequest({ type: 'edit', agent });
												} else if (type === 'details')
													setEditRequest({ type: 'details', agent });
												else if (type === 'delete') launchd.remove(agent);
												else
													launchd.runAction({ type, fileName: agent.fileName, label: agent.label });
											}}
										/>
									))}
							</ConnectionGroup>
						)
					);
				})}
			{editing && (
				<Dialog
					title="LaunchAgent"
					wide
					onClose={() => {
						if (launchd.busy || (dirty && !window.confirm('Discard unsaved changes?'))) return;
						setEditing(false);
						setDirty(false);
					}}
				>
					<div onChange={() => setDirty(true)}>
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
					{launchd.error && <Message kind="error">{launchd.error}</Message>}
					{launchd.notice && <Message kind="success">{launchd.notice}</Message>}
				</Dialog>
			)}

			{(launchd.detailsLoading || launchd.details) && (
				<LaunchdDetails
					loading={launchd.detailsLoading}
					details={launchd.details}
					onClose={launchd.closeDetails}
				/>
			)}
		</section>
	);
}

function Message({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
	const kindClassName =
		kind === 'error'
			? 'border-(--vscode-errorForeground) bg-(--vscode-inputValidation-errorBackground) text-(--vscode-errorForeground)'
			: 'border-(--vscode-testing-iconPassed) bg-(--vscode-editorWidget-background)';
	return (
		<div
			className={cn('mb-3.5 rounded-xs border border-l-2 px-3 py-2.5 text-xs', kindClassName)}
			role={kind === 'error' ? 'alert' : 'status'}
		>
			{children}
		</div>
	);
}
