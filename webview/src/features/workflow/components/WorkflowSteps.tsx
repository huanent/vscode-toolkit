import { useState } from 'react';
import { cn } from 'cn';
import { ArrowDown, ArrowUp, FolderOpen, Plus, Trash2 } from '../../../components/icons';
import { TextInput, TextArea, SelectInput } from '../../../components/input';
import type { Workflow, WorkflowStep } from '../../../../../src/features/workflow/workflow';
import { buttonClass, Field, IconButton } from './controls';

type Props = {
	draft: Workflow;
	servers: { id: string; name: string }[];
	activeStep: number;
	setActiveStep: (index: number) => void;
	change: (workflow: Workflow) => void;
	newStep: (type: WorkflowStep['type']) => WorkflowStep;
	updateStep: (index: number, step: WorkflowStep) => void;
	browse: (field: 'cwd' | 'localPath', index: number) => void;
};

export function WorkflowSteps({
	draft,
	servers,
	activeStep,
	setActiveStep,
	change,
	newStep,
	updateStep,
	browse,
}: Props) {
	const [stepType, setStepType] = useState<WorkflowStep['type']>('command');
	return (
		<div className="grid min-w-0 gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
			<aside
				aria-label="Workflow steps"
				className="min-w-0 border-b border-(--vscode-panel-border) pb-3 md:border-r md:border-b-0 md:pr-4"
			>
				<div className="flex flex-wrap items-center gap-2 border-b border-(--vscode-panel-border) pb-2">
					<h2 className="mr-auto text-sm font-semibold">Steps ({draft.steps.length})</h2>
					<SelectInput
						aria-label="New step type"
						className="w-36"
						value={stepType}
						onChange={event => setStepType(event.target.value as WorkflowStep['type'])}
					>
						<option value="command">Local Command</option>
						<option value="ssh">SSH Command</option>
						<option value="sftp">SFTP</option>
					</SelectInput>
					<button
						type="button"
						className={buttonClass}
						title="Add step"
						aria-label="Add step"
						onClick={() => {
							change({ ...draft, steps: [...draft.steps, newStep(stepType)] });
							setActiveStep(draft.steps.length);
						}}
					>
						<Plus size={16} />
					</button>
				</div>
				<ol className="mt-2 grid list-none gap-1 p-0">
					{draft.steps.map((step, index) => (
						<li key={`${draft.id}-${index}`}>
							<button
								type="button"
								aria-current={activeStep === index ? 'step' : undefined}
								className={cn(
									'flex w-full min-w-0 items-start gap-2 rounded-xs px-2 py-2 text-left text-xs',
									activeStep === index
										? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)'
										: 'hover:bg-(--vscode-list-hoverBackground)',
								)}
								onClick={() => setActiveStep(index)}
							>
								<span className="shrink-0">{index + 1}.</span>
								<span className="min-w-0 wrap-anywhere">
									{step.name || 'Untitled step'}
									<span className="mt-1 block opacity-70">
										{step.type === 'command'
											? 'Local Command'
											: step.type === 'ssh'
												? 'SSH Command'
												: step.action === 'download' ? 'SFTP Download' : 'SFTP Upload'}
									</span>
								</span>
							</button>
						</li>
					))}
				</ol>
			</aside>
			<div className="min-w-0">
				{!draft.steps.length && (
					<p
						role="status"
						className="py-8 text-center text-xs text-(--vscode-descriptionForeground)"
					>
						No steps yet.
					</p>
				)}
				{draft.steps.map((step, index) => (
					<section
						hidden={activeStep !== index}
						data-step-index={index}
						aria-label={`Step ${index + 1} details`}
						key={`${draft.id}-${index}`}
						className="min-w-0 border-b border-(--vscode-panel-border) py-2"
					>
						<h2 className="text-sm font-semibold">Step {index + 1}</h2>
						<div className="mb-3 flex flex-wrap items-end gap-1 pt-2">
							<div className="min-w-40 flex-1">
								<Field label="Step name">
									<TextInput
										aria-label={`Step ${index + 1} name`}
										required
										value={step.name}
										onChange={event => updateStep(index, { ...step, name: event.target.value })}
									/>
								</Field>
							</div>
							<div className="ml-auto flex shrink-0 items-center">
								<IconButton
									title="Move up"
									disabled={index === 0}
									onClick={() => {
										const steps = [...draft.steps];
										[steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];
										change({ ...draft, steps });
										setActiveStep(index - 1);
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
										setActiveStep(index + 1);
									}}
								>
									<ArrowDown size={14} />
								</IconButton>
								<IconButton
									title="Delete step"
									onClick={() => {
										change({
											...draft,
											steps: draft.steps.filter((_, position) => position !== index),
										});
										setActiveStep(Math.max(0, Math.min(index, draft.steps.length - 2)));
									}}
								>
									<Trash2 size={14} />
								</IconButton>
							</div>
						</div>
						<div className="grid min-w-0 gap-3 pb-4 sm:grid-cols-2">
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
									<option value="sftp">SFTP</option>
								</SelectInput>
							</Field>
							{step.type !== 'command' ? (
								<Field label="SSH connection">
									<SelectInput
										required
										value={step.serverId}
										onChange={event => updateStep(index, { ...step, serverId: event.target.value })}
									>
										<option value="">Select connection</option>
										{step.serverId && !servers.some(server => server.id === step.serverId) && (
											<option value={step.serverId}>Missing connection</option>
										)}
										{servers.map(server => (
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
											onChange={event => updateStep(index, { ...step, cwd: event.target.value })}
										/>
										<IconButton title="Choose directory" onClick={() => browse('cwd', index)}>
											<FolderOpen size={16} />
										</IconButton>
									</span>
								</Field>
							)}
							{step.type === 'sftp' ? (
								<>
									<Field label="Transfer direction">
										<SelectInput
											value={step.action ?? 'upload'}
											onChange={event => {
												const action = event.target.value as 'upload' | 'download';
												updateStep(index, { ...step, action, name: ['SFTP Upload', 'SFTP Download'].includes(step.name) ? (action === 'download' ? 'SFTP Download' : 'SFTP Upload') : step.name });
											}}
										>
											<option value="upload">Upload</option>
											<option value="download">Download</option>
										</SelectInput>
									</Field>
									<Field label={step.action === 'download' ? 'Local destination file' : 'Local source file'}>
										<span className="flex gap-1">
											<TextInput
												required
												value={step.localPath}
												onChange={event =>
													updateStep(index, { ...step, localPath: event.target.value })
												}
											/>
											<IconButton title={step.action === 'download' ? 'Choose download location' : 'Choose file'} onClick={() => browse('localPath', index)}>
												<FolderOpen size={16} />
											</IconButton>
										</span>
									</Field>
									<Field label={step.action === 'download' ? 'Remote source file' : 'Remote destination file'}>
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
			</div>
		</div>
	);
}
