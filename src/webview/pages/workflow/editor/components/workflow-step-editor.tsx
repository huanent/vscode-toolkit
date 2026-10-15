import type { WorkflowSshConnection, WorkflowStep } from '@/features/workflow/protocol';
import { FormItem } from '@/webview/components/form';
import { Input } from '@/webview/components/input';
import { Select } from '@/webview/components/select';
import { Textarea } from '@/webview/components/textarea';
import { directionOptions, workflowTypeOptions } from '@/webview/pages/workflow/editor/step-model';

type WorkflowStepEditorProps = {
  index: number;
  step: WorkflowStep;
  hosts: readonly WorkflowSshConnection[];
  onChange: (step: WorkflowStep) => void;
  onTypeChange: (type: WorkflowStep['type']) => void;
};

export function WorkflowStepEditor({ index, step, hosts, onChange, onTypeChange }: WorkflowStepEditorProps) {
  return (
    <div className="grid gap-5">
      <FormItem name={`steps.${index}.type`} label="Operation">
        <Select
          ariaLabel="Operation"
          value={step.type}
          onValueChange={(value) => onTypeChange(value as WorkflowStep['type'])}
          options={workflowTypeOptions}
        />
      </FormItem>

      {step.type !== 'local-command' && (
        <FormItem name={`steps.${index}.assetId`} label="SSH host">
          <Select
            ariaLabel="SSH host"
            value={hosts.some((host) => host.id === step.assetId) ? step.assetId : undefined}
            onValueChange={(assetId) => onChange({ ...step, assetId })}
            placeholder={hosts.length ? 'Select an SSH host' : 'No SSH hosts available'}
            options={hosts.map((host) => ({ value: host.id, label: `${host.name} (${host.host}:${host.port})` }))}
          />
          {!hosts.some((host) => host.id === step.assetId) && (
            <p role="status" className="text-(--vscode-editorWarning-foreground)">
              {hosts.length ? 'Select an available SSH host.' : 'No SSH hosts available.'}
            </p>
          )}
        </FormItem>
      )}

      {step.type !== 'sftp' && (
        <FormItem
          name={`steps.${index}.command`}
          label={step.type === 'local-command' ? 'Command' : 'Remote command'}
          control={{ value: step.command, onValueChange: (command) => onChange({ ...step, command }) }}
        >
          <Textarea
            className="min-h-48 font-mono"
            placeholder={step.type === 'local-command' ? 'npm run build' : 'uname -a'}
            spellCheck={false}
          />
        </FormItem>
      )}

      {step.type === 'local-command' && (
        <FormItem name={`steps.${index}.cwd`} label="Working directory">
          <Input
            value={step.cwd ?? ''}
            onChange={(event) => onChange({ ...step, cwd: event.target.value || undefined })}
            placeholder="Defaults to the current workspace"
            className="font-mono"
            spellCheck={false}
          />
        </FormItem>
      )}

      {step.type === 'sftp' && (
        <>
          <FormItem name={`steps.${index}.direction`} label="Direction">
            <Select
              ariaLabel="Transfer direction"
              value={step.direction}
              onValueChange={(direction) => onChange({ ...step, direction: direction as 'upload' | 'download' })}
              options={directionOptions}
            />
          </FormItem>
          <FormItem name={`steps.${index}.localPath`} label="Local file path">
            <Input
              value={step.localPath}
              onChange={(event) => onChange({ ...step, localPath: event.target.value })}
              placeholder="/path/to/file"
              className="font-mono"
              spellCheck={false}
            />
          </FormItem>
          <FormItem name={`steps.${index}.remotePath`} label="Remote file path">
            <Input
              value={step.remotePath}
              onChange={(event) => onChange({ ...step, remotePath: event.target.value })}
              placeholder="/srv/files/file"
              className="font-mono"
              spellCheck={false}
            />
          </FormItem>
        </>
      )}
    </div>
  );
}
