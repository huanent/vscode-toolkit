import { useId } from 'react';
import { cn } from 'cn';
import type { WorkflowSshConnection, WorkflowStep } from '@/features/workflow/protocol';
import { Button } from '@/webview/components/button';
import { FormItem } from '@/webview/components/form';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Select } from '@/webview/components/select';
import { Textarea } from '@/webview/components/textarea';
import {
  describeStep,
  directionOptions,
  getStepTypeLabel,
  isStepComplete,
  workflowTypeOptions,
} from '@/webview/pages/workflow/step-model';

type WorkflowStepEditorProps = {
  index: number;
  total: number;
  step: WorkflowStep;
  expanded: boolean;
  hosts: readonly WorkflowSshConnection[];
  onToggle: () => void;
  onChange: (step: WorkflowStep) => void;
  onTypeChange: (type: WorkflowStep['type']) => void;
  onMove: (offset: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

export function WorkflowStepEditor({
  index,
  total,
  step,
  expanded,
  hosts,
  onToggle,
  onChange,
  onTypeChange,
  onMove,
  onDuplicate,
  onRemove,
}: WorkflowStepEditorProps) {
  const stepNumber = index + 1;
  const bodyId = useId();
  const complete = isStepComplete(step);

  return (
    <li className={cn('relative pl-9', index < total - 1 && 'pb-3')}>
      {index < total - 1 && (
        <span aria-hidden="true" className="absolute top-8 bottom-0 left-3 w-px bg-(--vscode-panel-border)" />
      )}
      <span className="absolute top-2 left-0 flex size-6 items-center justify-center rounded-full bg-(--vscode-badge-background) text-xs font-semibold text-(--vscode-badge-foreground)">
        {stepNumber}
      </span>
      <section
        aria-label={`Step ${stepNumber}`}
        className="rounded-sm border border-(--vscode-panel-border) bg-(--vscode-editorWidget-background)"
      >
        <header className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={onToggle}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
          >
            <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size="sm" className="shrink-0" />
            <span className="shrink-0 font-semibold">{getStepTypeLabel(step.type)}</span>
            <span className="min-w-0 truncate text-(--vscode-descriptionForeground)">{describeStep(step, hosts)}</span>
            {!complete && (
              <span
                role="img"
                aria-label="Incomplete"
                title="Incomplete"
                className="flex shrink-0 text-(--vscode-editorWarning-foreground)"
              >
                <Icon name="warning" size="sm" />
              </span>
            )}
          </button>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Move step ${stepNumber} up`}
              title="Move up"
              prefix={<Icon name="arrow-up" />}
              disabled={index === 0}
              onClick={() => onMove(-1)}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Move step ${stepNumber} down`}
              title="Move down"
              prefix={<Icon name="arrow-down" />}
              disabled={index === total - 1}
              onClick={() => onMove(1)}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Duplicate step ${stepNumber}`}
              title="Duplicate step"
              prefix={<Icon name="copy" />}
              onClick={onDuplicate}
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove step ${stepNumber}`}
              title="Remove step"
              prefix={<Icon name="trash" />}
              disabled={total <= 1}
              onClick={onRemove}
            />
          </div>
        </header>

        {expanded && (
          <div id={bodyId} className="grid gap-3 border-t border-(--vscode-panel-border) p-3">
            <FormItem name={`steps.${index}.type`} label="Operation">
              <Select
                ariaLabel={`Operation for step ${stepNumber}`}
                value={step.type}
                onValueChange={(value) => onTypeChange(value as WorkflowStep['type'])}
                options={workflowTypeOptions}
              />
            </FormItem>

            {step.type === 'local-command' && (
              <>
                <FormItem
                  name={`steps.${index}.command`}
                  label="Command"
                  control={{ value: step.command, onValueChange: (value) => onChange({ ...step, command: value }) }}
                >
                  <Textarea className="font-mono" placeholder="npm run build" />
                </FormItem>
                <FormItem name={`steps.${index}.cwd`} label="Working directory">
                  <Input
                    value={step.cwd ?? ''}
                    onChange={(event) => onChange({ ...step, cwd: event.target.value || undefined })}
                    placeholder="Defaults to the current workspace"
                  />
                </FormItem>
              </>
            )}

            {step.type === 'ssh-command' && (
              <>
                <FormItem name={`steps.${index}.hostId`} label="SSH host">
                  <HostSelect value={step.hostId} hosts={hosts} onChange={(hostId) => onChange({ ...step, hostId })} />
                </FormItem>
                <FormItem
                  name={`steps.${index}.command`}
                  label="Remote command"
                  control={{ value: step.command, onValueChange: (value) => onChange({ ...step, command: value }) }}
                >
                  <Textarea className="font-mono" placeholder="uname -a" />
                </FormItem>
              </>
            )}

            {step.type === 'sftp' && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormItem name={`steps.${index}.hostId`} label="SSH host">
                    <HostSelect
                      value={step.hostId}
                      hosts={hosts}
                      onChange={(hostId) => onChange({ ...step, hostId })}
                    />
                  </FormItem>
                  <FormItem name={`steps.${index}.direction`} label="Direction">
                    <Select
                      ariaLabel={`Direction for step ${stepNumber}`}
                      value={step.direction}
                      onValueChange={(value) => onChange({ ...step, direction: value as 'upload' | 'download' })}
                      options={directionOptions}
                    />
                  </FormItem>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormItem name={`steps.${index}.localPath`} label="Local file path">
                    <Input
                      value={step.localPath}
                      onChange={(event) => onChange({ ...step, localPath: event.target.value })}
                      placeholder="/path/to/file"
                    />
                  </FormItem>
                  <FormItem name={`steps.${index}.remotePath`} label="Remote file path">
                    <Input
                      value={step.remotePath}
                      onChange={(event) => onChange({ ...step, remotePath: event.target.value })}
                      placeholder="/srv/files/file"
                    />
                  </FormItem>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </li>
  );
}

function HostSelect({
  value,
  hosts,
  onChange,
}: {
  value: string;
  hosts: readonly WorkflowSshConnection[];
  onChange: (hostId: string) => void;
}) {
  return (
    <Select
      ariaLabel="SSH host"
      value={value || undefined}
      onValueChange={onChange}
      placeholder={hosts.length ? 'Select an SSH host' : 'Add an SSH host in Assets'}
      options={hosts.map((host) => ({
        value: host.id,
        label: `${host.name} (${host.host}:${host.port})`,
      }))}
    />
  );
}
