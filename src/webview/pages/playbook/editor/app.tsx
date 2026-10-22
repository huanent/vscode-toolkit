import { useState } from 'react';
import type {
  PlaybookEditorData,
  PlaybookEditorMessage,
  PlaybookEditorRequest,
  PlaybookStep,
} from '@/features/playbook/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { StorageEditorHeader } from '@/webview/components/storage-editor-header';
import { Button } from '@/webview/components/ui/button';
import { Checkbox } from '@/webview/components/ui/checkbox';
import { Collapsible } from '@/webview/components/ui/collapsible';
import { ErrorMessage } from '@/webview/components/ui/error-message';
import { Form, FormItem } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { Loading } from '@/webview/components/ui/loading';
import { Popover } from '@/webview/components/ui/popover';
import { TabPanel, Tabs } from '@/webview/components/ui/tabs';
import { Textarea } from '@/webview/components/ui/textarea';
import { PlaybookEnvironmentEditor } from '@/webview/pages/playbook/editor/components/playbook-environment-editor';
import { PlaybookStepEditor } from '@/webview/pages/playbook/editor/components/playbook-step-editor';
import {
  convertStep,
  createStepItem,
  describeStep,
  isStepComplete,
  playbookTypeOptions,
} from '@/webview/pages/playbook/editor/step-model';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function App() {
  const state = useHostData<PlaybookEditorData, PlaybookEditorMessage>((message, previous) => {
    if (message.type === 'playbookSaved' && previous.status === 'loaded') {
      return { status: 'loaded', data: { ...previous.data, name: message.name } };
    }
    if (message.type === 'playbookEditorError') {
      return previous.status === 'loaded'
        ? { ...previous, error: message.message }
        : { status: 'error', message: message.message };
    }
    return undefined;
  });
  if (state.status === 'error') return <ErrorMessage message={state.message} />;
  if (state.status !== 'loaded') return <Loading label="Loading playbook..." />;
  return <PlaybookEditor data={state.data} error={state.error} />;
}

function PlaybookEditor({ data, error }: { data: PlaybookEditorData; error?: string }) {
  const sshHosts = data.assets.filter((asset) => asset.type === 'ssh');
  const [name, setName] = useState(data.name);
  const [description, setDescription] = useState(data.description ?? '');
  const [enableAI, setEnableAI] = useState(data.enableAI !== false);
  const [storageScope, setStorageScope] = useState(data.storageScope);
  const [activeTabId, setActiveTabId] = useState('general');
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [expandedStepId, setExpandedStepId] = useState<string>();
  const [environment, setEnvironment] = useState(data.playbook.environment ?? []);
  const [steps, setSteps] = useState(() => data.playbook.steps.map((step) => createStepItem(step)));
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

  const updateStep = (id: string, step: PlaybookStep) =>
    setSteps(steps.map((item) => (item.id === id ? { ...item, step } : item)));
  const addStep = (type: PlaybookStep['type']) => {
    const item = createStepItem({
      ...convertStep(undefined, type, sshHosts[0]?.id ?? ''),
      name: `Step ${steps.length + 1}`,
    });
    setSteps([...steps, item]);
    setExpandedStepId(item.id);
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
    const item = createStepItem({ ...steps[index].step, name: `Step ${index + 2}` });
    setSteps([...steps.slice(0, index + 1), item, ...steps.slice(index + 1)]);
    setExpandedStepId(item.id);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl text-(--vscode-foreground)">
      <Form
        className="flex min-h-screen min-w-0 flex-col"
        onInvalidCapture={(event) => {
          const section = (event.target as HTMLElement).closest<HTMLElement>('[data-playbook-section]');
          if (section?.dataset.playbookSection) setActiveTabId(section.dataset.playbookSection);
        }}
        onFormSubmit={() => {
          if (
            !name.trim() ||
            !steps.length ||
            !validEnvironment ||
            !steps.every((item) => isStepComplete(item.step, sshHosts))
          )
            return;
          postToHost({
            type: 'savePlaybook',
            name,
            description,
            storageScope,
            playbook: { steps: steps.map((item) => item.step), environment },
            enableAI,
          } satisfies PlaybookEditorRequest);
        }}
      >
        <StorageEditorHeader
          storageScope={storageScope}
          onStorageScopeChange={setStorageScope}
          workspaceStorageAvailable={data.workspaceStorageAvailable}
          saveDisabled={!name.trim() || !steps.length || !validEnvironment}
        />
        {error && <ErrorMessage message={error} />}
        <Tabs
          tabs={[
            { id: 'general', label: 'General' },
            { id: 'steps', label: 'Steps' },
            { id: 'variables', label: 'Variables' },
          ]}
          activeTabId={activeTabId}
          onChange={setActiveTabId}
          ariaLabel="Playbook sections"
          placement="left"
          className="mt-2 min-w-0"
        >
          <TabPanel tabId="general" keepMounted className="p-4 md:p-6">
            <div data-playbook-section="general" className="mx-auto grid w-full max-w-3xl">
              <FormItem name="name" label="Name" error="Playbook name is required." match="valueMissing">
                <Input
                  aria-label="Playbook name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Playbook name"
                  required
                  autoFocus
                />
              </FormItem>
              <FormItem name="enableAI" label="Allow AI tool access">
                <Checkbox checked={enableAI} onCheckedChange={(checked) => setEnableAI(checked === true)} />
              </FormItem>
              <FormItem name="description" label="Description">
                <Textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
              </FormItem>
            </div>
          </TabPanel>
          <TabPanel tabId="steps" keepMounted className="p-4 md:p-6">
            <div data-playbook-section="steps" className="mx-auto grid w-full max-w-3xl gap-5">
              <div className="flex min-w-0 flex-col">
                {steps.map((item, index) => (
                  <Collapsible
                    key={item.id}
                    defaultOpen={item.id === expandedStepId}
                    title={
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="shrink-0">{index + 1}</span>
                        <span className="min-w-0 truncate">{item.step.name}</span>
                        <span className="hidden min-w-0 flex-1 truncate text-xs font-normal text-(--vscode-descriptionForeground) sm:block">
                          {describeStep(item.step, sshHosts)}
                        </span>
                      </div>
                    }
                    actions={
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
                    }
                  >
                    <div className="grid min-w-0 gap-2 pb-2">
                      <PlaybookStepEditor
                        index={index}
                        step={item.step}
                        hosts={data.assets}
                        onChange={(step) => updateStep(item.id, step)}
                        onTypeChange={(type) =>
                          updateStep(item.id, convertStep(item.step, type, sshHosts[0]?.id ?? ''))
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
                      {playbookTypeOptions.map((option) => (
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
            <div data-playbook-section="variables" className="mx-auto grid w-full max-w-3xl gap-5">
              <PlaybookEnvironmentEditor environment={environment} onChange={setEnvironment} />
            </div>
          </TabPanel>
        </Tabs>
      </Form>
    </main>
  );
}

mountWebview('root', <App />);
