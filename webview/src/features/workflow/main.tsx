import { useEffect, useState, type ReactNode } from 'react';
import {
	ArrowDown,
	ArrowUp,
	FolderOpen,
	ListOrdered,
	Play,
	Plus,
	Save,
	Terminal,
	Trash2,
} from '../../components/icons';
import { cn } from 'cn';
import { TextInput, TextArea, SelectInput } from '../../components/input';
import { workflowApi as vscode, subscribe } from '../dashboard/channel';
import { ConnectionCard } from '../ssh/management/main';
import { Dialog } from '../../components/dialog';
import { StorageLocation } from '../../components/storage-location';
import type { Workflow, WorkflowStep } from '../../../../src/features/workflow/workflow';

type State = {
	locations: Record<string, string>;
	workspaceFolders: { name: string; uri: string }[];
	workflows: Workflow[];
	servers: { id: string; name: string }[];
	cwd: string;
	busy: boolean;
};
const buttonClass =
	'inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-xs px-2 text-xs hover:bg-(--vscode-toolbar-hoverBackground) focus-visible:outline focus-visible:outline-(--vscode-focusBorder) disabled:opacity-40';
function IconButton({
	title,
	children,
	onClick,
	disabled,
}: {
	title: string;
	children: ReactNode;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			className={cn(buttonClass, 'w-8')}
			title={title}
			aria-label={title}
			onClick={onClick}
			disabled={disabled}
		>
			{children}
		</button>
	);
}
function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<label className="flex min-w-0 flex-col gap-1.5 text-xs text-(--vscode-descriptionForeground)">
			<span>{label}</span>
			{children}
		</label>
	);
}

export function App() {
	const editorMode = document.body.dataset.toolkitEditor === 'true';
	const [editRequest, setEditRequest] = useState<{ workflow?: Workflow; id?: string }>();
	const [state, setState] = useState<State>({ workflows: [], servers: [], cwd: '', busy: false, locations: {}, workspaceFolders: [] });
	const [draftLocations, setDraftLocations] = useState<Record<string, string>>({});
	const [draft, setDraft] = useState<Workflow>();
	const [dirty, setDirty] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState('');
	const [search, setSearch] = useState('');
	const [loaded, setLoaded] = useState(false);
	const [nextDraft, setNextDraft] = useState<Workflow>();
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			const message = event.data;
			if (message.type === 'state') {
				setState(message);
				setLoaded(true);
			}
			if (message.type === 'saved') {
				setDraft(message.workflow);
				setDirty(false);
				setPending(false);
			}
			if (message.type === 'error') {
				setError(message.message);
				setPending(false);
			}
			if (message.type === 'deleted')
				setDraft(current => (current?.id === message.id ? undefined : current));
			if (message.type === 'path') {
				setDraft(current =>
					current && current.id === message.draftId
						? {
								...current,
								steps: current.steps.map((step, index) =>
									index === message.index ? { ...step, [message.field]: message.value } : step,
								),
							}
						: current,
				);
				setDirty(true);
			}
		};
		const unsubscribe = subscribe('workflow', receive);
		vscode.postMessage({ type: 'ready' });
		return unsubscribe;
	}, []);
	const locked = state.busy || pending;
	const change = (next: Workflow) => {
		setDraft(next);
		setDirty(true);
		setError('');
	};
	const select = (next: Workflow) => {
		if (!editorMode) {
			vscode.postMessage({ type: 'openEditor', workflow: next });
			return;
		}
		if (dirty) {
			setNextDraft(next);
			return;
		}
		setDraft(structuredClone(next));
		setDirty(false);
		setError('');
	};
	const newStep = (type: WorkflowStep['type']): WorkflowStep =>
		type === 'command'
			? { type, name: 'Local Command', command: '', cwd: state.cwd }
			: type === 'ssh'
				? { type, name: 'SSH Command', serverId: state.servers[0]?.id ?? '', command: '' }
				: {
						type,
						name: 'SFTP Upload',
						serverId: state.servers[0]?.id ?? '',
						localPath: '',
						remotePath: '',
					};
	const updateStep = (index: number, step: WorkflowStep) =>
		draft &&
		change({
			...draft,
			steps: draft.steps.map((current, position) => (position === index ? step : current)),
		});
	const submit = (type: 'save' | 'run') => {
		setError('');
		setPending(true);
		vscode.postMessage({ type, workflow: draft, location: draft ? (state.locations[draft.id] ?? draftLocations[draft.id] ?? '') : '' });
	};
	useEffect(() => {
		const edit = (event: Event) => setEditRequest((event as CustomEvent).detail);
		window.addEventListener('toolkitEdit', edit);
		return () => window.removeEventListener('toolkitEdit', edit);
	}, []);
	useEffect(() => {
		if (!editRequest || !loaded) return;
		const next = editRequest.workflow ?? state.workflows.find(item => item.id === editRequest.id);
		if (next) select(next);
		else setError('The workflow no longer exists.');
		setEditRequest(undefined);
	}, [editRequest, loaded, state.workflows]);
	useEffect(() => {
		const open = (event: Event) => {
			const detail = (event as CustomEvent).detail;
			const workflow = state.workflows.find(item => item.id === detail.id);
			if (detail.tab === 'workflow' && workflow && !locked) select(workflow);
		};
		window.addEventListener('dashboardOpenItem', open);
		return () => window.removeEventListener('dashboardOpenItem', open);
	}, [state.workflows, dirty, locked]);
	return (
		<div className="flex flex-col py-4 text-(--vscode-foreground)">
			<header className="flex min-h-9 flex-wrap items-center gap-1 border-b border-(--vscode-panel-border)">
				<ListOrdered size={18} />
				<h1 className="text-sm font-semibold">Workflow</h1>
				<span className="ml-auto text-xs text-(--vscode-descriptionForeground)" role="status">
					{state.busy ? 'Running...' : pending ? 'Saving...' : dirty ? 'Unsaved changes' : 'Ready'}
				</span>
				<IconButton title="Show output" onClick={() => vscode.postMessage({ type: 'output' })}>
					<Terminal size={16} />
				</IconButton>
			</header>
			<div>
				<section className="py-3" hidden={editorMode}>
					<div className="mb-3 flex items-center gap-2">
						<TextInput
							aria-label="Search workflows"
							placeholder="Search workflows"
							value={search}
							onChange={event => setSearch(event.target.value)}
						/>
						<IconButton
							title="New workflow"
							disabled={locked}
							onClick={() => select({ id: crypto.randomUUID(), name: 'New Workflow', steps: [] })}
						>
							<Plus size={16} />
						</IconButton>
					</div>
					<ul className="m-0 grid list-none grid-cols-1 gap-1 p-0" aria-label="Workflows">
						{state.workflows
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
										if (type === 'run') vscode.postMessage({ type: 'run', workflow });
										else if (type === 'delete')
											vscode.postMessage({ type: 'delete', id: workflow.id });
										else select(workflow);
									}}
								/>
							))}
					</ul>
					{!loaded && <p className="text-xs">Loading...</p>}
					{loaded &&
						!state.workflows.some(workflow =>
							workflow.name.toLowerCase().includes(search.toLowerCase()),
						) && (
							<p
								role="status"
								className="py-6 text-center text-xs text-(--vscode-descriptionForeground)"
							>
								{search ? 'No matching workflows.' : 'No workflows yet.'}
							</p>
						)}
					{error && !draft && (
						<p role="alert" className="text-xs text-(--vscode-errorForeground)">
							{error}
						</p>
					)}
				</section>
				{draft && (
					<Dialog
						title="Workflow"
						wide
						onClose={() => {
							if (locked || (dirty && !window.confirm('Discard unsaved changes?'))) return;
							setDraft(undefined);
							setDirty(false);
						}}
					>
						{nextDraft && (
							<div
								role="alert"
								className="mb-4 flex flex-wrap items-center gap-2 border border-(--vscode-panel-border) p-3 text-xs"
							>
								<span className="mr-auto">Discard unsaved changes?</span>
								<button
									className={buttonClass}
									onClick={() => {
										setDraft(structuredClone(nextDraft));
										setNextDraft(undefined);
										setDirty(false);
										setError('');
									}}
								>
									Discard
								</button>
								<button className={buttonClass} onClick={() => setNextDraft(undefined)}>
									Keep Editing
								</button>
							</div>
						)}
						{error && (
							<div
								role="alert"
								className="mb-4 wrap-break-word border-l-2 border-(--vscode-errorForeground) bg-(--vscode-inputValidation-errorBackground) p-3 text-xs"
							>
								{error}
							</div>
						)}
						{draft ? (
							<form
								onSubmit={event => {
									event.preventDefault();
									submit('save');
								}}
							>
								<fieldset disabled={locked} className="min-w-0">
									<StorageLocation
										value={state.locations[draft.id] ?? draftLocations[draft.id] ?? ''}
										folders={state.workspaceFolders}
										disabled={locked || state.workflows.some(workflow => workflow.id === draft.id)}
										onChange={location => {
											setDraftLocations(current => ({ ...current, [draft.id]: location }));
											setDirty(true);
										}}
									/>
									<div className="mb-5 flex flex-wrap items-end gap-2">
										<div className="min-w-40 flex-1">
											<Field label="Workflow name">
												<TextInput
													required
													value={draft.name}
													onChange={event => change({ ...draft, name: event.target.value })}
												/>
											</Field>
										</div>
										<button className={buttonClass} type="submit" title="Save workflow">
											<Save size={16} />
											Save
										</button>
										<button
											className={cn(
												buttonClass,
												'bg-(--vscode-button-background) text-(--vscode-button-foreground)',
											)}
											type="button"
											disabled={!draft.steps.length}
											onClick={event => {
												if (event.currentTarget.form?.reportValidity()) submit('run');
											}}
										>
											<Play size={16} />
											Run
										</button>
										<IconButton
											title="Delete workflow"
											disabled={!state.workflows.some(workflow => workflow.id === draft.id)}
											onClick={() => vscode.postMessage({ type: 'delete', id: draft.id })}
										>
											<Trash2 size={16} />
										</IconButton>
									</div>
									<div className="mb-5">
										<Field label="Workflow description">
											<TextArea
												rows={2}
												value={draft.description ?? ''}
												onChange={event => change({ ...draft, description: event.target.value })}
											/>
										</Field>
									</div>
									<div className="flex items-center justify-between border-b border-(--vscode-panel-border) pb-2">
										<h2 className="text-xs font-semibold">Steps ({draft.steps.length})</h2>
										<button
											type="button"
											className={buttonClass}
											onClick={() =>
												change({ ...draft, steps: [...draft.steps, newStep('command')] })
											}
										>
											<Plus size={16} />
											Add Step
										</button>
									</div>
									{draft.steps.map((step, index) => (
										<section
											key={`${draft.id}-${index}`}
											className="border-b border-(--vscode-panel-border) py-4"
										>
											<div className="mb-3 flex items-center gap-2">
												<span className="w-6 shrink-0 text-xs text-(--vscode-descriptionForeground)">
													{index + 1}.
												</span>
												<TextInput
													aria-label={`Step ${index + 1} name`}
													required
													value={step.name}
													onChange={event =>
														updateStep(index, { ...step, name: event.target.value })
													}
												/>
												<IconButton
													title="Move up"
													disabled={index === 0}
													onClick={() => {
														const steps = [...draft.steps];
														[steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];
														change({ ...draft, steps });
													}}
												>
													<ArrowUp size={14} />
												</IconButton>
												<IconButton
													title="Move down"
													disabled={index === draft.steps.length - 1}
													onClick={() => {
														const steps = [...draft.steps];
														[steps[index + 1], steps[index]] = [steps[index], steps[index + 1]];
														change({ ...draft, steps });
													}}
												>
													<ArrowDown size={14} />
												</IconButton>
												<IconButton
													title="Delete step"
													onClick={() =>
														change({
															...draft,
															steps: draft.steps.filter((_, position) => position !== index),
														})
													}
												>
													<Trash2 size={14} />
												</IconButton>
											</div>
											<div className="grid gap-3 sm:grid-cols-2">
												<Field label="Type">
													<SelectInput
														value={step.type}
														onChange={event =>
															updateStep(index, {
																...newStep(event.target.value as WorkflowStep['type']),
																name: step.name,
															})
														}
													>
														<option value="command">Local Command</option>
														<option value="ssh">SSH Command</option>
														<option value="sftp">SFTP Upload</option>
													</SelectInput>
												</Field>
												{step.type !== 'command' ? (
													<Field label="SSH connection">
														<SelectInput
															required
															value={step.serverId}
															onChange={event =>
																updateStep(index, { ...step, serverId: event.target.value })
															}
														>
															<option value="">Select connection</option>
															{step.serverId &&
																!state.servers.some(server => server.id === step.serverId) && (
																	<option value={step.serverId}>Missing connection</option>
																)}
															{state.servers.map(server => (
																<option key={server.id} value={server.id}>
																	{server.name}
																</option>
															))}
														</SelectInput>
													</Field>
												) : (
													<Field label="Working directory">
														<span className="flex gap-1">
															<TextInput
																required
																value={step.cwd}
																onChange={event =>
																	updateStep(index, { ...step, cwd: event.target.value })
																}
															/>
															<IconButton
																title="Choose directory"
																onClick={() =>
																	vscode.postMessage({
																		type: 'browse',
																		field: 'cwd',
																		index,
																		draftId: draft.id,
																	})
																}
															>
																<FolderOpen size={16} />
															</IconButton>
														</span>
													</Field>
												)}
												{step.type === 'sftp' ? (
													<>
														<Field label="Local file">
															<span className="flex gap-1">
																<TextInput
																	required
																	value={step.localPath}
																	onChange={event =>
																		updateStep(index, { ...step, localPath: event.target.value })
																	}
																/>
																<IconButton
																	title="Choose file"
																	onClick={() =>
																		vscode.postMessage({
																			type: 'browse',
																			field: 'localPath',
																			index,
																			draftId: draft.id,
																		})
																	}
																>
																	<FolderOpen size={16} />
																</IconButton>
															</span>
														</Field>
														<Field label="Remote file path">
															<TextInput
																required
																value={step.remotePath}
																onChange={event =>
																	updateStep(index, { ...step, remotePath: event.target.value })
																}
															/>
														</Field>
													</>
												) : (
													<div className="sm:col-span-2">
														<Field label="Command">
															<TextArea
																required
																value={step.command}
																onChange={event =>
																	updateStep(index, { ...step, command: event.target.value })
																}
															/>
														</Field>
													</div>
												)}
											</div>
										</section>
									))}
								</fieldset>
							</form>
						) : (
							<div className="flex min-h-64 flex-col items-center justify-center gap-4">
								<ListOrdered size={32} className="text-(--vscode-descriptionForeground)" />
								<h2 className="text-sm">
									{state.workflows.length ? 'Select a workflow' : 'No workflows'}
								</h2>
								<button
									className={buttonClass}
									disabled={locked}
									onClick={() =>
										select({ id: crypto.randomUUID(), name: 'New Workflow', steps: [] })
									}
								>
									<Plus size={16} />
									New Workflow
								</button>
							</div>
						)}
					</Dialog>
				)}
			</div>
		</div>
	);
}
