import { useState } from 'react';
import { cn } from 'cn';
import type {
  WorkflowEditorData,
  WorkflowEditorMessage,
  WorkflowEditorRequest,
  WorkflowStep,
} from '@/features/workflow/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { StorageScopeSelector } from '@/webview/components/storage-editor-header';
import { Button } from '@/webview/components/ui/button';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Form, FormItem } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { Loading } from '@/webview/components/ui/loading';
import { Popover } from '@/webview/components/ui/popover';
import { TabPanel, Tabs } from '@/webview/components/ui/tabs';
import { WorkflowEnvironmentEditor } from '@/webview/pages/workflow/editor/components/workflow-environment-editor';
import { WorkflowStepEditor } from '@/webview/pages/workflow/editor/components/workflow-step-editor';
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
  const [activeTabId, setActiveTabId] = useState('steps');
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [environment, setEnvironment] = useState(data.workflow.environment ?? []);
  const [steps, setSteps] = useState(() =>
    (data.workflow.steps.length ? data.workflow.steps : [convertStep(undefined, 'local-command', '')]).map((step) =>
      createStepItem(step),
    ),
  );
  const [selectedId, setSelectedId] = useState(steps[0].id);
  const selectedIndex = steps.findIndex((item) => item.id === selectedId);
  const selected = steps[selectedIndex];
  const completeCount = steps.filter((item) => isStepComplete(item.step, data.sshConnections)).length;
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

  const updateStep = (step: WorkflowStep) =>
    setSteps(steps.map((item) => (item.id === selectedId ? { ...item, step } : item)));
  const addStep = (type: WorkflowStep['type']) => {
    const item = createStepItem(convertStep(undefined, type, data.sshConnections[0]?.id ?? ''));
    setSteps([...steps, item]);
    setSelectedId(item.id);
    setAddStepOpen(false);
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

  return (
    <main className="flex min-h-screen min-w-0 flex-col text-(--vscode-foreground)">
      <Form
        className="flex min-w-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim() || !validEnvironment) return;
          postToHost({
            type: 'saveWorkflow',
            name,
            storageScope,
            workflow: { steps: steps.map((item) => item.step), environment },
          } satisfies WorkflowEditorRequest);
        }}
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-(--vscode-panel-border) px-2 py-1.5">
          <FormItem name="name" className="min-w-32 flex-1">
            <Input
              aria-label="Workflow name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Workflow name"
            />
          </FormItem>
          <StorageScopeSelector
            value={storageScope}
            onValueChange={setStorageScope}
            workspaceAvailable={data.workspaceStorageAvailable}
          />
          <Button
            type="submit"
            variant="ghost"
            title="Save workflow"
            aria-label="Save workflow"
            prefix={<Icon name="save" />}
            disabled={!name.trim() || !validEnvironment}
          />
        </header>
        {error && (
          <div role="alert" className="px-2 py-1">
            <ErrorMessage message={error} />
          </div>
        )}
        <Tabs
          tabs={[
            { id: 'steps', label: `Steps (${steps.length})`, icon: <Icon name="list-ordered" size="sm" /> },
            {
              id: 'variables',
              label: `Variables (${environment.length})`,
              icon: <Icon name="symbol-variable" size="sm" />,
            },
          ]}
          activeTabId={activeTabId}
          onChange={setActiveTabId}
          ariaLabel="Workflow sections"
          className="flex-1"
          contentClassName="flex flex-1 flex-col"
        >
          <TabPanel tabId="steps" className="flex flex-1 flex-col">
            <div className="flex flex-1 flex-col md:flex-row">
              <aside
                aria-label="Workflow steps"
                className="min-w-0 border-b border-(--vscode-panel-border) bg-(--vscode-sideBar-background) md:w-64 md:shrink-0 md:border-r md:border-b-0"
              >
                <div className="flex h-8 items-center justify-between gap-2 px-2">
                  <h2 className="text-xs font-semibold uppercase">Steps</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-(--vscode-descriptionForeground)">
                      {completeCount}/{steps.length}
                    </span>
                    <Popover
                      open={addStepOpen}
                      onOpenChange={setAddStepOpen}
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Add step"
                          title="Add step"
                          prefix={<Icon name="add" />}
                        />
                      }
                    >
                      <div role="group" aria-label="Step type" className="grid p-1">
                        {workflowTypeOptions.map((option) => (
                          <Button
                            key={option.value}
                            variant="ghost"
                            className="justify-start"
                            onClick={() => addStep(option.value)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </Popover>
                  </div>
                </div>
                <ol>
                  {steps.map((item, index) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-current={item.id === selectedId ? 'step' : undefined}
                        title={describeStep(item.step, data.sshConnections)}
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          'flex h-7 w-full min-w-0 cursor-pointer items-center gap-2 px-2 text-left',
                          item.id === selectedId
                            ? 'bg-(--vscode-list-activeSelectionBackground) text-(--vscode-list-activeSelectionForeground)'
                            : 'hover:bg-(--vscode-list-hoverBackground)',
                        )}
                      >
                        <span className="w-4 shrink-0 text-right font-mono text-xs opacity-70">{index + 1}</span>
                        <Icon
                          name={
                            item.step.type === 'local-command'
                              ? 'terminal'
                              : item.step.type === 'ssh-command'
                                ? 'remote'
                                : 'arrow-swap'
                          }
                          size="sm"
                        />
                        <span className="min-w-0 flex-1 truncate">{getStepTypeLabel(item.step.type)}</span>
                        {!isStepComplete(item.step, data.sshConnections) && (
                          <span title="Incomplete" aria-label="Incomplete">
                            <Icon name="warning" size="sm" />
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ol>
              </aside>
              <section aria-label="Step editor" className="min-w-0 flex-1">
                <header className="flex min-h-8 flex-wrap items-center justify-between gap-1 border-b border-(--vscode-panel-border) px-2">
                  <h2 className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="text-(--vscode-descriptionForeground)">{selectedIndex + 1}</span>
                    {getStepTypeLabel(selected.step.type)}
                  </h2>
                  <div role="group" aria-label="Step actions" className="flex items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Move up"
                      aria-label="Move step up"
                      prefix={<Icon name="arrow-up" />}
                      disabled={selectedIndex === 0}
                      onClick={() => moveStep(-1)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Move down"
                      aria-label="Move step down"
                      prefix={<Icon name="arrow-down" />}
                      disabled={selectedIndex === steps.length - 1}
                      onClick={() => moveStep(1)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Duplicate step"
                      aria-label="Duplicate step"
                      prefix={<Icon name="copy" />}
                      onClick={duplicateStep}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Remove step"
                      aria-label="Remove step"
                      prefix={<Icon name="trash" />}
                      disabled={steps.length === 1}
                      onClick={removeStep}
                    />
                  </div>
                </header>
                <div className="p-3">
                  <WorkflowStepEditor
                    index={selectedIndex}
                    step={selected.step}
                    hosts={data.sshConnections}
                    onChange={updateStep}
                    onTypeChange={(type) =>
                      updateStep(convertStep(selected.step, type, data.sshConnections[0]?.id ?? ''))
                    }
                  />
                </div>
              </section>
            </div>
          </TabPanel>
          <TabPanel tabId="variables">
            <WorkflowEnvironmentEditor environment={environment} onChange={setEnvironment} />
          </TabPanel>
        </Tabs>
      </Form>
    </main>
  );
}

mountWebview('root', <App />);
