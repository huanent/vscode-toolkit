import { useState } from 'react';
import type {
  WorkflowEditorData,
  WorkflowEditorMessage,
  WorkflowEditorRequest,
  WorkflowStep,
} from '@/features/workflow/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { StorageEditorHeader } from '@/webview/components/storage-editor-header';
import { Button } from '@/webview/components/ui/button';
import { Collapsible } from '@/webview/components/ui/collapsible';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Form, FormItem } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { Loading } from '@/webview/components/ui/loading';
import { Popover } from '@/webview/components/ui/popover';
import { TabPanel, Tabs } from '@/webview/components/ui/tabs';
import { Textarea } from '@/webview/components/ui/textarea';
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
  const [description, setDescription] = useState(data.description ?? '');
  const [storageScope, setStorageScope] = useState(data.storageScope);
  const [activeTabId, setActiveTabId] = useState('general');
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [environment, setEnvironment] = useState(data.workflow.environment ?? []);
  const [steps, setSteps] = useState(() => data.workflow.steps.map((step) => createStepItem(step)));
  const validEnvironment = environment.every(
    (variable, index) =>
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.name) &&
      (typeof variable.defaultValue !== 'string' || !variable.defaultValue.includes('\0')) &&
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

  const updateStep = (id: string, step: WorkflowStep) =>
    setSteps(steps.map((item) => (item.id === id ? { ...item, step } : item)));
  const addStep = (type: WorkflowStep['type']) => {
    const item = createStepItem(convertStep(undefined, type, data.sshConnections[0]?.id ?? ''));
    setSteps([...steps, item]);
    setAddStepOpen(false);
  };
  const moveStep = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next);
  };
  const duplicateStep = (index: number) => {
    const item = createStepItem({ ...steps[index].step });
    setSteps([...steps.slice(0, index + 1), item, ...steps.slice(index + 1)]);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl text-(--vscode-foreground)">
      <Form
        className="flex min-h-screen min-w-0 flex-col"
        onInvalidCapture={(event) => {
          const section = (event.target as HTMLElement).closest<HTMLElement>('[data-workflow-section]');
          if (section?.dataset.workflowSection) setActiveTabId(section.dataset.workflowSection);
        }}
        onFormSubmit={() => {
          if (!name.trim() || !steps.length || !validEnvironment) return;
          postToHost({
            type: 'saveWorkflow',
            name,
            description,
            storageScope,
            workflow: { steps: steps.map((item) => item.step), environment },
          } satisfies WorkflowEditorRequest);
        }}
      >
        <StorageEditorHeader
          storageScope={storageScope}
          onStorageScopeChange={setStorageScope}
          workspaceStorageAvailable={data.workspaceStorageAvailable}
          saveDisabled={!name.trim() || !steps.length || !validEnvironment}
        />
        {error && (
          <div role="alert" className="px-4 py-3">
            <ErrorMessage message={error} />
          </div>
        )}
        <Tabs
          tabs={[
            { id: 'general', label: 'General' },
            { id: 'steps', label: `Steps (${steps.length})` },
            {
              id: 'variables',
              label: `Variables (${environment.length})`,
            },
          ]}
          activeTabId={activeTabId}
          onChange={setActiveTabId}
          ariaLabel="Workflow sections"
          placement="left"
          className="mt-2 min-w-0 flex-1"
        >
          <TabPanel tabId="general" keepMounted className="p-4 md:p-6">
            <div data-workflow-section="general" className="mx-auto grid w-full max-w-3xl gap-5">
              <FormItem name="name" label="Name" error="Workflow name is required." match="valueMissing">
                <Input
                  aria-label="Workflow name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Workflow name"
                  required
                  autoFocus
                />
              </FormItem>
              <FormItem name="description" label="Description (optional)">
                <Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
              </FormItem>
            </div>
          </TabPanel>
          <TabPanel tabId="steps" keepMounted className="p-4 md:p-6">
            <div data-workflow-section="steps" className="mx-auto grid w-full max-w-3xl gap-5">
              <div className="flex min-w-0 flex-col gap-3">
                {steps.map((item, index) => (
                  <Collapsible
                    key={item.id}
                    defaultOpen
                    title={
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="shrink-0">{index + 1}</span>
                        <span className="min-w-0 truncate">{getStepTypeLabel(item.step.type)}</span>
                        <span className="hidden min-w-0 flex-1 truncate text-xs font-normal text-(--vscode-descriptionForeground) sm:block">
                          {describeStep(item.step, data.sshConnections)}
                        </span>
                        {!isStepComplete(item.step, data.sshConnections) && (
                          <span title="Incomplete" aria-label="Incomplete">
                            <Icon name="warning" size="sm" />
                          </span>
                        )}
                      </div>
                    }
                  >
                    <div className="grid min-w-0 gap-3 pb-3">
                      <div role="group" aria-label={`Step ${index + 1} actions`} className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Move up"
                          aria-label={`Move step ${index + 1} up`}
                          prefix={<Icon name="arrow-up" />}
                          disabled={index === 0}
                          onClick={() => moveStep(index, -1)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Move down"
                          aria-label={`Move step ${index + 1} down`}
                          prefix={<Icon name="arrow-down" />}
                          disabled={index === steps.length - 1}
                          onClick={() => moveStep(index, 1)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Duplicate step"
                          aria-label={`Duplicate step ${index + 1}`}
                          prefix={<Icon name="copy" />}
                          onClick={() => duplicateStep(index)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Remove step"
                          aria-label={`Remove step ${index + 1}`}
                          prefix={<Icon name="trash" />}
                          onClick={() => setSteps(steps.filter((current) => current.id !== item.id))}
                        />
                      </div>
                      <WorkflowStepEditor
                        index={index}
                        step={item.step}
                        hosts={data.sshConnections}
                        onChange={(step) => updateStep(item.id, step)}
                        onTypeChange={(type) =>
                          updateStep(item.id, convertStep(item.step, type, data.sshConnections[0]?.id ?? ''))
                        }
                      />
                    </div>
                  </Collapsible>
                ))}
                <div>
                  <Popover
                    open={addStepOpen}
                    onOpenChange={setAddStepOpen}
                    trigger={
                      <Button variant="secondary" prefix={<Icon name="add" />}>
                        Add step
                      </Button>
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
            </div>
          </TabPanel>
          <TabPanel tabId="variables" keepMounted className="p-4 md:p-6">
            <div data-workflow-section="variables" className="mx-auto grid w-full max-w-3xl gap-5">
              <WorkflowEnvironmentEditor environment={environment} onChange={setEnvironment} />
            </div>
          </TabPanel>
        </Tabs>
      </Form>
    </main>
  );
}

mountWebview('root', <App />);
