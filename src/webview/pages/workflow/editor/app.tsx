import { useState } from 'react';
import { cn } from 'cn';
import type {
  WorkflowEditorData,
  WorkflowEditorMessage,
  WorkflowEditorRequest,
  WorkflowStep,
} from '@/features/workflow/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/ui/button';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Form } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';
import { Loading } from '@/webview/components/ui/loading';
import { Popover } from '@/webview/components/ui/popover';
import { StorageEditorHeader } from '@/webview/components/storage-editor-header';
import { WorkflowStepEditor } from '@/webview/pages/workflow/editor/components/workflow-step-editor';
import { WorkflowEnvironmentEditor } from '@/webview/pages/workflow/editor/components/workflow-environment-editor';
import {
  convertStep,
  createStepItem,
  describeStep,
  getStepTypeLabel,
  isStepComplete,
  workflowTypeOptions,
} from '@/webview/pages/workflow/editor/step-model';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function App() {
  const state = useHostData<WorkflowEditorData, WorkflowEditorMessage>((message, previous) => {
    if (message.type === 'workflowSaved' && previous.status === 'loaded') {
      return { status: 'loaded', data: { ...previous.data, name: message.name } };
    }
    if (message.type === 'workflowEditorError') {
      return previous.status === 'loaded'
        ? { ...previous, error: message.message }
        : { status: 'error', message: message.message };
    }
    return undefined;
  });

  if (state.status === 'error') return <ErrorMessage message={state.message} />;
  if (state.status !== 'loaded') return <Loading label="Loading workflow..." />;
  return <WorkflowEditor data={state.data} error={state.error} />;
}

function WorkflowEditor({ data, error }: { data: WorkflowEditorData; error?: string }) {
  const [name, setName] = useState(data.name);
  const [storageScope, setStorageScope] = useState(data.storageScope);
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [environment, setEnvironment] = useState(data.workflow.environment ?? []);
  const validEnvironment = environment.every(
    (variable, index) =>
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.name) &&
      (variable.type !== 'select' ||
        (variable.options.length > 0 &&
          variable.options.every(
            (option) =>
              option.value.trim().length > 0 && !option.value.includes('\0') && option.label.trim().length > 0,
          ) &&
          new Set(variable.options.map((option) => option.value)).size === variable.options.length &&
          variable.options.some((option) => option.value === variable.defaultValue))) &&
      !environment.some(
        (other, otherIndex) => otherIndex !== index && other.name.toUpperCase() === variable.name.toUpperCase(),
      ),
  );
  const [steps, setSteps] = useState(() =>
    (data.workflow.steps.length ? data.workflow.steps : [convertStep(undefined, 'local-command', '')]).map((step) =>
      createStepItem(step),
    ),
  );
  const [selectedId, setSelectedId] = useState(steps[0].id);
  const selectedIndex = steps.findIndex((item) => item.id === selectedId);
  const selected = steps[selectedIndex];
  const completeCount = steps.filter((item) => isStepComplete(item.step, data.sshConnections)).length;
  const defaultAssetId = data.sshConnections[0]?.id ?? '';

  const addStep = (type: WorkflowStep['type']) => {
    const item = createStepItem(convertStep(undefined, type, defaultAssetId));
    setSteps([...steps, item]);
    setSelectedId(item.id);
    setAddStepOpen(false);
  };
  const updateStep = (step: WorkflowStep) => {
    setSteps(steps.map((item) => (item.id === selectedId ? { ...item, step } : item)));
  };
  const moveStep = (offset: number) => {
    const target = selectedIndex + offset;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    setSteps(next);
  };
  const duplicateStep = () => {
    const item = createStepItem({ ...selected.step });
    setSteps([...steps.slice(0, selectedIndex + 1), item, ...steps.slice(selectedIndex + 1)]);
    setSelectedId(item.id);
  };
  const removeStep = () => {
    if (steps.length === 1) return;
    setSteps(steps.filter((item) => item.id !== selectedId));
    setSelectedId(steps[selectedIndex + 1]?.id ?? steps[selectedIndex - 1].id);
  };
  const save = () => {
    if (!validEnvironment) return;
    postToHost({
      type: 'saveWorkflow',
      name,
      storageScope,
      workflow: { steps: steps.map((item) => item.step), environment },
    } satisfies WorkflowEditorRequest);
  };

  return (
    <main className="min-h-screen text-(--vscode-foreground)">
      <Form
        className="flex min-h-screen flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <StorageEditorHeader
          name={name}
          onNameChange={setName}
          namePlaceholder="Workflow name"
          storageScope={storageScope}
          onStorageScopeChange={setStorageScope}
          workspaceStorageAvailable={data.workspaceStorageAvailable}
          saveDisabled={!name.trim() || !validEnvironment}
        />

        {error && (
          <div role="alert" className="px-4 py-3">
            <ErrorMessage message={error} />
          </div>
        )}

        <WorkflowEnvironmentEditor environment={environment} onChange={setEnvironment} />

        <div className="grid flex-1 md:grid-cols-3">
          <aside
            aria-label="Workflow steps"
            className="min-w-0 border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background) md:border-r md:border-b-0"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <h2 className="font-semibold">Steps</h2>
              <span className="text-xs text-(--vscode-descriptionForeground)">
                {completeCount}/{steps.length} ready
              </span>
            </div>
            <ol className="grid max-h-64 gap-1 overflow-y-auto px-2 pb-3 md:max-h-none">
              {steps.map((item, index) => {
                const active = item.id === selectedId;
                const complete = isStepComplete(item.step, data.sshConnections);
                return (
                  <li key={item.id} className="min-w-0">
                    <button
                      type="button"
                      aria-current={active ? 'step' : undefined}
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-sm border-l-2 p-3 text-left',
                        active
                          ? 'border-(--vscode-focusBorder) bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)'
                          : 'border-transparent hover:bg-(--vscode-list-hoverBackground)',
                      )}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center font-mono text-xs">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="grid min-w-0 flex-1 gap-1">
                        <span className="font-medium">{getStepTypeLabel(item.step.type)}</span>
                        <span
                          className="truncate text-xs opacity-80"
                          title={describeStep(item.step, data.sshConnections)}
                        >
                          {describeStep(item.step, data.sshConnections)}
                        </span>
                      </div>
                      <span title={complete ? 'Ready' : 'Incomplete'} aria-label={complete ? 'Ready' : 'Incomplete'}>
                        <Icon name={complete ? 'check' : 'circle-outline'} size="sm" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="px-4 pb-4">
              <Popover
                open={addStepOpen}
                onOpenChange={setAddStepOpen}
                trigger={
                  <Button variant="secondary" prefix={<Icon name="add" size="sm" />}>
                    Add step
                  </Button>
                }
              >
                <div role="group" aria-label="Step type" className="grid gap-1 p-1">
                  {workflowTypeOptions.map((option) => (
                    <Button
                      key={option.value}
                      variant="ghost"
                      size="lg"
                      className="justify-start"
                      onClick={() => addStep(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </Popover>
            </div>
          </aside>

          <section aria-label="Step editor" className="min-w-0 p-4 md:col-span-2 md:p-6">
            <div className="mx-auto grid w-full max-w-3xl gap-5">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-(--vscode-panel-border) pb-4">
                <div className="grid min-w-0 gap-1">
                  <span className="text-xs text-(--vscode-descriptionForeground)">
                    Step {selectedIndex + 1} of {steps.length}
                  </span>
                  <h2 className="text-xl font-semibold">{getStepTypeLabel(selected.step.type)}</h2>
                </div>
                <div role="group" aria-label="Step actions" className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    aria-label="Move step up"
                    title="Move up"
                    prefix={<Icon name="arrow-up" />}
                    disabled={selectedIndex === 0}
                    onClick={() => moveStep(-1)}
                  />
                  <Button
                    variant="ghost"
                    aria-label="Move step down"
                    title="Move down"
                    prefix={<Icon name="arrow-down" />}
                    disabled={selectedIndex === steps.length - 1}
                    onClick={() => moveStep(1)}
                  />
                  <Button
                    variant="ghost"
                    aria-label="Duplicate step"
                    title="Duplicate step"
                    prefix={<Icon name="copy" />}
                    onClick={duplicateStep}
                  />
                  <Button
                    variant="ghost"
                    aria-label="Remove step"
                    title="Remove step"
                    prefix={<Icon name="trash" />}
                    disabled={steps.length === 1}
                    onClick={removeStep}
                  />
                </div>
              </header>
              <WorkflowStepEditor
                key={selected.id}
                index={selectedIndex}
                step={selected.step}
                hosts={data.sshConnections}
                onChange={updateStep}
                onTypeChange={(type) => updateStep(convertStep(selected.step, type, defaultAssetId))}
              />
            </div>
          </section>
        </div>
      </Form>
    </main>
  );
}

mountWebview('root', <App />);
