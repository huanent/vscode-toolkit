import { createRoot } from 'react-dom/client';
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
} from 'lucide-react';
import { cn } from 'cn';
import { TextInput, TextArea, SelectInput } from '../../components/input';
import { vscode } from '../../vscodeApi';
import type { Workflow, WorkflowStep } from '../../../../src/features/workflow/workflow';

type State = {
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

function App() {
	const [state, setState] = useState<State>({ workflows: [], servers: [], cwd: '', busy: false });
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
		window.addEventListener('message', receive);
		vscode.postMessage({ type: 'ready' });
		return () => window.removeEventListener('message', receive);
	}, []);
	const locked = state.busy || pending;
	const change = (next: Workflow) => {
		setDraft(next);
		setDirty(true);
		setError('');
	};
	const select = (next: Workflow) => {
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
		vscode.postMessage({ type, workflow: draft });
	};
	return (
		<div className="flex min-h-screen flex-col bg-(--vscode-editor-background) text-(--vscode-foreground)">
			<header className="flex h-12 shrink-0 items-center gap-2 border-b border-(--vscode-panel-border) px-4">
				<ListOrdered size={18} />
				<h1 className="text-sm font-semibold">Workflow</h1>
				<span className="ml-auto text-xs text-(--vscode-descriptionForeground)" role="status">
					{state.busy ? 'Running...' : pending ? 'Saving...' : dirty ? 'Unsaved changes' : 'Ready'}
				</span>
				<IconButton title="Show output" onClick={() => vscode.postMessage({ type: 'output' })}>
					<Terminal size={16} />
				</IconButton>
			</header>
			<div className="grid flex-1 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)]">
				<aside className="border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background) p-3 md:border-r md:border-b-0">
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
					<nav className="max-h-48 overflow-auto md:max-h-none" aria-label="Workflows">
						{state.workflows
							.filter(workflow => workflow.name.toLowerCase().includes(search.toLowerCase()))
							.map(workflow => (
								<button
									key={workflow.id}
									disabled={locked}
									onClick={() => select(workflow)}
									className={cn(
										'mb-1 flex w-full items-center gap-2 rounded-xs px-2 py-2 text-left text-xs hover:bg-(--vscode-list-hoverBackground)',
										draft?.id === workflow.id &&
											'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)',
									)}
								>
									<ListOrdered size={14} className="shrink-0" />
									<span className="min-w-0 flex-1 wrap-break-word">{workflow.name}</span>
									<span>{workflow.steps.length}</span>
								</button>
							))}
					</nav>
					{!loaded && <p className="text-xs">Loading...</p>}
				</aside>
				<main className="min-w-0 p-4 md:p-6">
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
												onChange={event => updateStep(index, { ...step, name: event.target.value })}
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
								onClick={() => select({ id: crypto.randomUUID(), name: 'New Workflow', steps: [] })}
							>
								<Plus size={16} />
								New Workflow
							</button>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}

createRoot(document.getElementById('root')!).render(<App />);
