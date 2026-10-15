import { useState } from 'react';
import type { WorkflowRunFormData, WorkflowRunFormRequest } from '@/features/workflow/protocol';
import { mountWebview } from '@/webview/bootstrap';
import { Button } from '@/webview/components/button';
import { Checkbox } from '@/webview/components/checkbox';
import { ErrorMessage } from '@/webview/components/error-message';
import { Form, FormItem } from '@/webview/components/form';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Loading } from '@/webview/components/loading';
import { Select } from '@/webview/components/select';
import { postToHost, useHostData } from '@/webview/utils/host-data';
import '@/webview/styles.css';

function App() {
  const state = useHostData<WorkflowRunFormData>();
  if (state.status === 'error') return <ErrorMessage message={state.message} />;
  if (state.status !== 'loaded') return <Loading label="Loading workflow..." />;
  return <WorkflowRunForm data={state.data} />;
}

function WorkflowRunForm({ data }: { data: WorkflowRunFormData }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(data.environment.map((variable) => [variable.name, String(variable.defaultValue)])),
  );
  const [submitting, setSubmitting] = useState(false);
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-5 p-4 md:p-6">
      <h1 className="wrap-anywhere text-xl font-semibold">{data.name}</h1>
      <Form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (submitting) return;
          setSubmitting(true);
          postToHost({ type: 'submitWorkflowRun', values } satisfies WorkflowRunFormRequest);
        }}
      >
        {data.environment.map((variable) => (
          <FormItem
            key={variable.name}
            name={variable.name}
            label={variable.label || variable.name}
            className="min-w-0 wrap-anywhere"
          >
            {variable.type === 'checkbox' ? (
              <Checkbox
                checked={values[variable.name] === 'true'}
                disabled={submitting}
                onCheckedChange={(checked) => setValues({ ...values, [variable.name]: String(checked) })}
              />
            ) : variable.type === 'select' ? (
              <Select
                value={values[variable.name]}
                options={variable.options}
                disabled={submitting}
                onValueChange={(value) => setValues({ ...values, [variable.name]: value })}
              />
            ) : (
              <Input
                value={values[variable.name]}
                disabled={submitting}
                onChange={(event) => setValues({ ...values, [variable.name]: event.target.value })}
              />
            )}
          </FormItem>
        ))}
        <div className="flex flex-wrap justify-end gap-2 border-t border-(--vscode-panel-border) pt-4">
          <Button
            variant="secondary"
            disabled={submitting}
            onClick={() => {
              setSubmitting(true);
              postToHost({ type: 'cancelWorkflowRun' } satisfies WorkflowRunFormRequest);
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} prefix={<Icon name="play" />}>
            Run
          </Button>
        </div>
      </Form>
    </main>
  );
}

mountWebview('root', <App />);
