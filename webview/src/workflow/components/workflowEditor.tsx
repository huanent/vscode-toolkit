import { Button } from '@webview/components/ui/button';
import { Save } from '@webview/components/ui/icons';
import { Input as TextInput, Textarea as TextArea } from '@webview/components/ui/input';
import { StorageLocation } from '@webview/components/storageLocation';
import type { WorkflowController } from '../hooks/useWorkflow';
import { Field } from './controls';
import { WorkflowSteps } from './workflowSteps';

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
		discard,
		changeLocation,
		location,
		keepEditing,
		browse,
	} = controller;
	if (!draft) return null;
	return (
		<div className="min-w-0">
			{nextDraft && (
				<div
					role="alert"
					className="mb-4 flex flex-wrap items-center gap-2 border border-(--vscode-panel-border) p-3 text-xs"
				>
					<span className="mr-auto">Discard unsaved changes?</span>
					<Button variant="plain" onClick={discard}>
						Discard
					</Button>
					<Button variant="plain" onClick={keepEditing}>
						Keep Editing
					</Button>
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
					<header className="sticky top-0 z-10 border-b border-(--vscode-panel-border) bg-(--vscode-editor-background) py-3.5 max-[680px]:static">
						<div className="mx-auto w-[min(880px,calc(100%-44px))] max-[680px]:w-[calc(100%-28px)]">
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
							<div className="flex flex-wrap items-center justify-end gap-3">
								<span className="text-xs text-(--vscode-descriptionForeground)" role="status">
									{pending
										? 'Saving...'
										: dirty
											? 'Unsaved changes'
											: state.workflows.some(workflow => workflow.id === draft.id)
												? 'Saved'
												: 'Not saved'}
								</span>
								<Button htmlType="submit" left={<Save />}>
									Save
								</Button>
							</div>
						</div>
					</header>
					<main className="mx-auto w-[min(880px,calc(100%-44px))] pt-6 pb-10 max-[680px]:w-[calc(100%-28px)] max-[680px]:pt-4">
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
					</main>
				</fieldset>
			</form>
		</div>
	);
}
