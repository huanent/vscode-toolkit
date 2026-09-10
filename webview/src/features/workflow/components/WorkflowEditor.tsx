import { cn } from 'cn';
import { Save } from '../../../components/icons';
import { TextInput, TextArea } from '../../../components/input';
import { Dialog } from '../../../components/dialog';
import { StorageLocation } from '../../../components/storage-location';
import type { WorkflowController } from '../hooks/useWorkflow';
import { buttonClass, Field } from './controls';
import { WorkflowSteps } from './WorkflowSteps';

export function WorkflowEditor({ controller }: { controller: WorkflowController }) {
	const {
		state,
		draft,
		dirty,
		pending,
		error,
		locked,
		nextDraft,
		activeStep,
		setActiveStep,
		change,
		newStep,
		updateStep,
		submit,
		close,
		discard,
		changeLocation,
		location,
		keepEditing,
		browse,
	} = controller;
	if (!draft) return null;
	return (
		<Dialog title={draft.name || 'New Workflow'} wide onClose={close}>
			{nextDraft && (
				<div
					role="alert"
					className="mb-4 flex flex-wrap items-center gap-2 border border-(--vscode-panel-border) p-3 text-xs"
				>
					<span className="mr-auto">Discard unsaved changes?</span>
					<button className={buttonClass} onClick={discard}>
						Discard
					</button>
					<button className={buttonClass} onClick={keepEditing}>
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
			<form
				noValidate
				onSubmit={event => {
					event.preventDefault();
					if (locked) return;
					const invalid = event.currentTarget.querySelector<
						HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
					>('input:invalid, select:invalid, textarea:invalid');
					if (invalid) {
						const panel = invalid.closest<HTMLElement>('[data-step-index]');
						if (panel) setActiveStep(Number(panel.dataset.stepIndex));
						requestAnimationFrame(() => invalid.reportValidity());
						return;
					}
					submit();
				}}
			>
				<fieldset disabled={locked} className="min-w-0">
					<StorageLocation
						value={location}
						folders={state.workspaceFolders}
						disabled={locked}
						onChange={changeLocation}
					/>
					<div className="mb-4 grid items-start gap-3 sm:grid-cols-2">
						<div className="min-w-40 flex-1">
							<Field label="Workflow name">
								<TextInput
									required
									value={draft.name}
									onChange={event => change({ ...draft, name: event.target.value })}
								/>
							</Field>
						</div>
						<Field label="Workflow description">
							<TextArea
								className="min-h-8"
								rows={2}
								value={draft.description ?? ''}
								onChange={event => change({ ...draft, description: event.target.value })}
							/>
						</Field>
					</div>
					<div className="mb-4 flex items-center justify-end gap-3 border-b border-(--vscode-panel-border) pb-4">
						<span className="text-xs text-(--vscode-descriptionForeground)" role="status">
							{pending
								? 'Saving...'
								: dirty
									? 'Unsaved changes'
									: state.workflows.some(workflow => workflow.id === draft.id)
										? 'Saved'
										: 'Not saved'}
						</span>
						<button
							type="submit"
							className={cn(
								buttonClass,
								'bg-(--vscode-button-background) text-(--vscode-button-foreground) hover:bg-(--vscode-button-hoverBackground)',
							)}
						>
							<Save size={16} />
							Save
						</button>
					</div>
					<WorkflowSteps
						draft={draft}
						servers={state.servers}
						activeStep={activeStep}
						setActiveStep={setActiveStep}
						change={change}
						newStep={newStep}
						updateStep={updateStep}
						browse={browse}
					/>
				</fieldset>
			</form>
		</Dialog>
	);
}
