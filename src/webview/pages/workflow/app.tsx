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
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

type WorkflowEditorForm = {
  name: string;
  workflow: WorkflowDefinition;
};

const workflowTypes = [
  { value: 'local-command', label: 'Local command' },
  { value: 'sftp', label: 'SFTP transfer' },
  { value: 'ssh-command', label: 'SSH command' },
] as const;

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
      setForm({ name: state.data.name, workflow: state.data.workflow });
    }
  }, [state, form]);

  if (state.status !== 'loaded' || !form) {
    return state.status === 'error' ? (
      <ErrorMessage message={state.message} />
    ) : (
      <Loading label="Loading workflow..." />
    );
  }

  const workflow = form.workflow;
  const updateWorkflow = (workflow: WorkflowDefinition) => {
    setForm((current) => (current ? { ...current, workflow } : current));
  };
  const updateStep = (index: number, step: WorkflowStep) => {
    updateWorkflow({ steps: workflow.steps.map((current, stepIndex) => (stepIndex === index ? step : current)) });
  };
  const createStep = (type: WorkflowStep['type']): WorkflowStep => {
    const firstHostId = state.data.sshConnections[0]?.id ?? '';
    if (type === 'local-command') return { type, command: '' };
    if (type === 'sftp') return { type, hostId: firstHostId, direction: 'upload', localPath: '', remotePath: '' };
    return { type, hostId: firstHostId, command: '' };
  };
  const moveStep = (index: number, offset: number) => {
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= workflow.steps.length) return;
    const steps = [...workflow.steps];
    [steps[index], steps[targetIndex]] = [steps[targetIndex], steps[index]];
    updateWorkflow({ steps });
  };
  const removeStep = (index: number) => {
    if (workflow.steps.length <= 1) return;
    updateWorkflow({ steps: workflow.steps.filter((_, stepIndex) => stepIndex !== index) });
  };
  const send = (type: WorkflowEditorRequest['type']) => {
    postToHost({ type, name: form.name, workflow: form.workflow } satisfies WorkflowEditorRequest);
  };

  return (
    <main className="flex min-h-screen flex-col text-(--vscode-foreground)">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-(--vscode-panel-border) px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Icon name="debug-line-by-line" size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{form.name || 'New workflow'}</h1>
            <p className=" text-(--vscode-descriptionForeground)">Workflow editor</p>
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
          {workflow.steps.map((step, index) => (
            <section key={index} className="grid gap-3 border border-(--vscode-panel-border) p-3">
              <header className="flex items-center justify-between gap-2">
                <h2 className=" font-semibold">Step {index + 1}</h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Move step ${index + 1} up`}
                    title="Move up"
                    prefix={<Icon name="arrow-up" />}
                    disabled={index === 0}
                    onClick={() => moveStep(index, -1)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Move step ${index + 1} down`}
                    title="Move down"
                    prefix={<Icon name="arrow-down" />}
                    disabled={index === workflow.steps.length - 1}
                    onClick={() => moveStep(index, 1)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove step ${index + 1}`}
                    title="Remove step"
                    prefix={<Icon name="trash" />}
                    disabled={workflow.steps.length <= 1}
                    onClick={() => removeStep(index)}
                  />
                </div>
              </header>
              <FormItem
                name={`steps.${index}.type`}
                label="Operation"
                className=""
                control={{
                  value: step.type,
                  onValueChange: (value) => updateStep(index, createStep(value as WorkflowStep['type'])),
                }}
              >
                <select className="h-7 w-full rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2  text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none">
                  {workflowTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormItem>

              {step.type === 'local-command' && (
                <>
                  <FormItem
                    name={`steps.${index}.command`}
                    label="Command"
                    className=""
                    control={{
                      value: step.command,
                      onValueChange: (value) => updateStep(index, { ...step, command: value }),
                    }}
                  >
                    <textarea
                      className="min-h-24 w-full rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) p-2 font-mono  text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none"
                      placeholder="npm run build"
                    />
                  </FormItem>
                  <FormItem name={`steps.${index}.cwd`} label="Working directory" className="">
                    <Input
                      value={step.cwd ?? ''}
                      onChange={(event) => updateStep(index, { ...step, cwd: event.target.value || undefined })}
                      placeholder="Defaults to the current workspace"
                    />
                  </FormItem>
                </>
              )}

              {step.type === 'ssh-command' && (
                <>
                  <HostPicker
                    value={step.hostId}
                    hosts={state.data.sshConnections}
                    onChange={(hostId) => updateStep(index, { ...step, hostId })}
                  />
                  <FormItem
                    name={`steps.${index}.command`}
                    label="Remote command"
                    className=""
                    control={{
                      value: step.command,
                      onValueChange: (value) => updateStep(index, { ...step, command: value }),
                    }}
                  >
                    <textarea
                      className="min-h-24 w-full rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) p-2 font-mono  text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none"
                      placeholder="uname -a"
                    />
                  </FormItem>
                </>
              )}

              {step.type === 'sftp' && (
                <>
                  <HostPicker
                    value={step.hostId}
                    hosts={state.data.sshConnections}
                    onChange={(hostId) => updateStep(index, { ...step, hostId })}
                  />
                  <FormItem
                    name={`steps.${index}.direction`}
                    label="Direction"
                    className=""
                    control={{
                      value: step.direction,
                      onValueChange: (value) =>
                        updateStep(index, { ...step, direction: value as 'upload' | 'download' }),
                    }}
                  >
                    <select className="h-7 w-full rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2  text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none">
                      <option value="upload">Upload local file to host</option>
                      <option value="download">Download host file to local</option>
                    </select>
                  </FormItem>
                  <FormItem name={`steps.${index}.localPath`} label="Local file path" className="">
                    <Input
                      value={step.localPath}
                      onChange={(event) => updateStep(index, { ...step, localPath: event.target.value })}
                      placeholder="/path/to/file"
                    />
                  </FormItem>
                  <FormItem name={`steps.${index}.remotePath`} label="Remote file path" className="">
                    <Input
                      value={step.remotePath}
                      onChange={(event) => updateStep(index, { ...step, remotePath: event.target.value })}
                      placeholder="/srv/files/file"
                    />
                  </FormItem>
                </>
              )}
            </section>
          ))}
          <Button
            variant="secondary"
            prefix={<Icon name="add" />}
            onClick={() => updateWorkflow({ steps: [...workflow.steps, createStep('local-command')] })}
          >
            Add step
          </Button>
        </div>

        {state.error && (
          <p role="alert" className=" text-(--vscode-errorForeground)">
            {state.error}
          </p>
        )}
      </Form>
    </main>
  );
}

function HostPicker({
  value,
  hosts,
  onChange,
}: {
  value: string;
  hosts: WorkflowEditorData['sshConnections'];
  onChange: (hostId: string) => void;
}) {
  return (
    <FormItem name="hostId" label="SSH host" className="" control={{ value, onValueChange: onChange, required: true }}>
      <select className="h-7 w-full rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2  text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none">
        <option value="" disabled>
          {hosts.length ? 'Select an SSH host' : 'Add an SSH host in Assets'}
        </option>
        {hosts.map((host) => (
          <option key={host.id} value={host.id}>
            {host.name} ({host.host}:{host.port})
          </option>
        ))}
      </select>
    </FormItem>
  );
}

mountWebview('root', <App />);
