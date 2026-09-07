import { cn } from 'cn';
import { Activity, LoaderCircle, Pause, Play, Rocket, Trash2 } from 'lucide-react';
import type { LaunchAgent, LaunchAgentState } from '../types';
import { statusLabel } from '../utils';

const stateClassNames: Record<LaunchAgentState, string> = {
	running: 'bg-(--vscode-testing-iconPassed) shadow-sm shadow-(--vscode-testing-iconPassed)',
	loaded: 'bg-(--vscode-charts-yellow)',
	unloaded: 'bg-(--vscode-descriptionForeground)',
	error: 'bg-(--vscode-testing-iconFailed)',
};

export function StatusDot({ state, title }: { state: LaunchAgentState; title?: string }) {
	return (
		<span
			className={cn('size-2 shrink-0 rounded-full ring-1 ring-current', stateClassNames[state])}
			title={title}
		/>
	);
}

export function AgentList({
	agents,
	selectedFileName,
	busy,
	detailsLoading,
	onSelect,
	onAction,
	onDetails,
	onRemove,
}: {
	agents: LaunchAgent[];
	selectedFileName?: string;
	busy: boolean;
	detailsLoading: boolean;
	onSelect(agent: LaunchAgent): void;
	onAction(message: object): void;
	onDetails(agent: LaunchAgent): void;
	onRemove(agent: LaunchAgent): void;
}) {
	return (
		<aside
			className="border-r border-(--vscode-panel-border) bg-(--vscode-sideBar-background) max-[760px]:max-h-77.5 max-[760px]:overflow-auto max-[760px]:border-r-0 max-[760px]:border-b"
			aria-label="LaunchAgents"
		>
			<div className="sticky top-0 z-10 flex min-h-11 items-center justify-between border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background) px-3.5 text-[11px] font-semibold uppercase text-(--vscode-sideBarSectionHeader-foreground,var(--vscode-foreground))">
				<span>Agents</span>
				<span className="grid h-5 min-w-5 place-items-center rounded-full bg-(--vscode-badge-background) px-1.5 text-[10px] font-normal text-(--vscode-badge-foreground)">
					{agents.length}
				</span>
			</div>
			{busy && agents.length === 0 ? (
				<EmptyState
					icon={<LoaderCircle className="animate-spin" size={22} />}
					label="Scanning LaunchAgents"
				/>
			) : agents.length === 0 ? (
				<EmptyState icon={<Rocket size={22} />} label="No LaunchAgents found" />
			) : (
				agents.map(agent => {
					const selected = selectedFileName === agent.fileName;
					return (
						<article
							key={agent.fileName}
							className={cn(
								'group relative flex min-h-14.5 items-center justify-between gap-2 border-b border-(--vscode-tree-tableColumnsBorder) py-2 pr-2 pl-3.5 transition-colors duration-75 hover:bg-(--vscode-list-hoverBackground)',
								selected &&
									'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground) before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-(--vscode-focusBorder)',
							)}
							onClick={() => onSelect(agent)}
						>
							<div className="flex min-w-0 items-center gap-2.5">
								<StatusDot state={agent.state} title={statusLabel(agent)} />
								<div className="min-w-0">
									<strong className="block truncate text-xs font-semibold">{agent.label}</strong>
									<small
										className={cn(
											'mt-1 block truncate text-[11px]',
											selected
												? 'text-inherit opacity-75'
												: 'text-(--vscode-descriptionForeground)',
										)}
									>
										{statusLabel(agent)}
									</small>
								</div>
							</div>
							<div className="flex gap-0.5 opacity-0 transition-opacity duration-100 group-hover:opacity-100 focus-within:opacity-100 max-[760px]:opacity-100">
								<RowButton
									title="Runtime details"
									aria-label={`View runtime details for ${agent.label}`}
									disabled={detailsLoading || agent.state === 'error'}
									onClick={event => {
										event.stopPropagation();
										onDetails(agent);
									}}
								>
									<Activity size={14} />
								</RowButton>
								{agent.state === 'running' || agent.state === 'loaded' ? (
									<RowButton
										title="Stop"
										aria-label={`Stop ${agent.label}`}
										disabled={busy}
										onClick={event => {
											event.stopPropagation();
											onAction({ type: 'stop', label: agent.label });
										}}
									>
										<Pause size={14} />
									</RowButton>
								) : (
									<RowButton
										title="Start"
										aria-label={`Start ${agent.label}`}
										disabled={busy || agent.state === 'error'}
										onClick={event => {
											event.stopPropagation();
											onAction({ type: 'start', fileName: agent.fileName, label: agent.label });
										}}
									>
										<Play size={14} />
									</RowButton>
								)}
								<RowButton
									className="hover:text-(--vscode-errorForeground)"
									title="Delete"
									aria-label={`Delete ${agent.label}`}
									disabled={busy}
									onClick={event => {
										event.stopPropagation();
										onRemove(agent);
									}}
								>
									<Trash2 size={14} />
								</RowButton>
							</div>
						</article>
					);
				})
			)}
		</aside>
	);
}

function RowButton({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			className={cn(
				'grid size-6.5 place-items-center rounded-xs border-0 bg-transparent text-inherit hover:bg-(--vscode-toolbar-hoverBackground) disabled:cursor-default disabled:opacity-45',
				className,
			)}
			{...props}
		/>
	);
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
	return (
		<div className="grid min-h-47.5 place-content-center justify-items-center gap-2.5 text-xs text-(--vscode-descriptionForeground)">
			{icon}
			<span>{label}</span>
		</div>
	);
}
