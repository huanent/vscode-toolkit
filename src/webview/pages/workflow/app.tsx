import { useEffect, useState } from 'react';
import type {
  WorkflowDefinition,
  WorkflowEditorData,
  WorkflowEditorMessage,
  WorkflowEditorRequest,
  WorkflowStep,
} from '@/features/workflow/protocol';
import { Button } from '@/webview/components/button';
import { ErrorMessage } from '@/webview/components/error-message';
import { Form, FormItem } from '@/webview/components/form';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Loading } from '@/webview/components/loading';
import { mountWebview } from '@/webview/bootstrap';
import { WorkflowStepEditor } from '@/webview/pages/workflow/components/workflow-step-editor';
import { convertStep, createStepItem, type WorkflowStepItem } from '@/webview/pages/workflow/step-model';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

const expandByDefaultLimit = 3;

type WorkflowEditorForm = {
  name: string;
  steps: WorkflowStepItem[];
};

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
  const [form, setForm] = useState<WorkflowEditorForm>();

  useEffect(() => {
    if (state.status === 'loaded' && !form) {
      const { steps } = state.data.workflow;
      const expanded = steps.length <= expandByDefaultLimit;
      setForm({ name: state.data.name, steps: steps.map((step) => createStepItem(step, expanded)) });
    }
  }, [state, form]);

  if (state.status !== 'loaded' || !form) {
    return state.status === 'error' ? (
      <ErrorMessage message={state.message} />
    ) : (
      <Loading label="Loading workflow..." />
    );
  }

  const steps = form.steps;
  const allCollapsed = steps.every((item) => !item.expanded);
  const defaultHostId = state.data.sshConnections[0]?.id ?? '';
  const updateSteps = (update: (items: WorkflowStepItem[]) => WorkflowStepItem[]) => {
    setForm((current) => (current ? { ...current, steps: update(current.steps) } : current));
  };
  const updateStep = (index: number, step: WorkflowStep) => {
    updateSteps((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, step } : item)));
  };
  const toggleStep = (index: number) => {
    updateSteps((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, expanded: !item.expanded } : item)),
    );
  };
  const setAllExpanded = (expanded: boolean) => {
    updateSteps((items) => items.map((item) => ({ ...item, expanded })));
  };
  const addStep = () => {
    updateSteps((items) => [...items, createStepItem(convertStep(undefined, 'local-command', defaultHostId), true)]);
  };
  const duplicateStep = (index: number) => {
    updateSteps((items) => {
      const source = items[index];
      if (!source) return items;
      return [...items.slice(0, index + 1), createStepItem({ ...source.step }, true), ...items.slice(index + 1)];
    });
  };
  const moveStep = (index: number, offset: number) => {
    updateSteps((items) => {
      const targetIndex = index + offset;
      if (targetIndex < 0 || targetIndex >= items.length) return items;
      const next = [...items];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };
  const removeStep = (index: number) => {
    updateSteps((items) => (items.length <= 1 ? items : items.filter((_, itemIndex) => itemIndex !== index)));
  };
  const send = (type: WorkflowEditorRequest['type']) => {
    const workflow: WorkflowDefinition = { steps: form.steps.map((item) => item.step) };
    postToHost({ type, name: form.name, workflow } satisfies WorkflowEditorRequest);
  };

  return (
    <main className="flex min-h-screen flex-col text-(--vscode-foreground)">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-(--vscode-panel-border) bg-(--vscode-editor-background) px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Icon name="debug-line-by-line" size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{form.name || 'New workflow'}</h1>
            <p className="text-(--vscode-descriptionForeground)">
              {steps.length} {steps.length === 1 ? 'step' : 'steps'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" prefix={<Icon name="play" />} onClick={() => send('runWorkflow')}>
            Run
          </Button>
          <Button prefix={<Icon name="save" />} onClick={() => send('saveWorkflow')}>
            Save
          </Button>
        </div>
      </header>

      <Form className="grid w-full max-w-3xl gap-5 px-5 py-5" onSubmit={(event) => event.preventDefault()}>
        <FormItem name="name" label="Name" className="">
          <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </FormItem>
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Steps</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                prefix={<Icon name={allCollapsed ? 'expand-all' : 'collapse-all'} />}
                onClick={() => setAllExpanded(allCollapsed)}
              >
                {allCollapsed ? 'Expand all' : 'Collapse all'}
              </Button>
              <Button variant="secondary" size="sm" prefix={<Icon name="add" />} onClick={addStep}>
                Add step
              </Button>
            </div>
          </div>
          <ol className="grid">
            {steps.map((item, index) => (
              <WorkflowStepEditor
                key={item.id}
                index={index}
                total={steps.length}
                step={item.step}
                expanded={item.expanded}
                hosts={state.data.sshConnections}
                onToggle={() => toggleStep(index)}
                onChange={(next) => updateStep(index, next)}
                onTypeChange={(type) => updateStep(index, convertStep(item.step, type, defaultHostId))}
                onMove={(offset) => moveStep(index, offset)}
                onDuplicate={() => duplicateStep(index)}
                onRemove={() => removeStep(index)}
              />
            ))}
          </ol>
          <Button variant="secondary" className="justify-self-start" prefix={<Icon name="add" />} onClick={addStep}>
            Add step
          </Button>
        </div>

        {state.error && <ErrorMessage message={state.error} />}
      </Form>
    </main>
  );
}

mountWebview('root', <App />);
