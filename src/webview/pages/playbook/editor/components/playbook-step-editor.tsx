import type { PlaybookStep } from '@/features/playbook/protocol';
import type { AssetSummary } from '@/features/assets/protocol';
import { AssetSelect } from '@/webview/components/asset-select';
import { FormItem } from '@/webview/components/ui/form';
import { Input } from '@/webview/components/ui/input';
import { Select } from '@/webview/components/ui/select';
import { Textarea } from '@/webview/components/ui/textarea';
import { directionOptions, playbookTypeOptions } from '@/webview/pages/playbook/editor/step-model';

type PlaybookStepEditorProps = {
  index: number;
  step: PlaybookStep;
  hosts: readonly AssetSummary[];
  onChange: (step: PlaybookStep) => void;
  onTypeChange: (type: PlaybookStep['type']) => void;
};

export function PlaybookStepEditor({ index, step, hosts, onChange, onTypeChange }: PlaybookStepEditorProps) {
  const sshHosts = hosts.filter((host) => host.type === 'ssh');
  return (
    <div className="grid">
      <FormItem
        name={`steps.${index}.name`}
        label="Name"
        invalid={!step.name.trim()}
        error={!step.name.trim() ? 'Step name is required.' : undefined}
        match={true}
        control={{ value: step.name, onValueChange: (name) => onChange({ ...step, name }), required: true }}
      >
        <Input placeholder={`Step ${index + 1}`} />
      </FormItem>
      <FormItem name={`steps.${index}.type`} label="Operation">
        <Select
          ariaLabel="Operation"
          value={step.type}
          onValueChange={(value) => onTypeChange(value as PlaybookStep['type'])}
          options={playbookTypeOptions}
        />
      </FormItem>

      {step.type !== 'local-command' && (
        <FormItem
          name={`steps.${index}.assetId`}
          label="SSH host"
          invalid={!sshHosts.some((host) => host.id === step.assetId)}
          error={
            !sshHosts.some((host) => host.id === step.assetId)
              ? sshHosts.length
                ? 'Select an available SSH host.'
                : 'No SSH hosts available.'
              : undefined
          }
          match={true}
        >
          <AssetSelect
            ariaLabel="SSH host"
            value={step.assetId}
            onValueChange={(assetId) => onChange({ ...step, assetId })}
            placeholder={sshHosts.length ? 'Select an SSH host' : 'No SSH hosts available'}
            assets={hosts}
            filter={(asset) => asset.type === 'ssh'}
          />
        </FormItem>
      )}

      {step.type !== 'sftp' && (
        <FormItem
          name={`steps.${index}.command`}
          label={step.type === 'local-command' ? 'Command' : 'Remote command'}
          invalid={!step.command.trim()}
          error={!step.command.trim() ? 'Command is required.' : undefined}
          match={true}
          control={{ value: step.command, onValueChange: (command) => onChange({ ...step, command }), required: true }}
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
          <FormItem
            name={`steps.${index}.localPath`}
            label="Local file path"
            invalid={!step.localPath.trim()}
            error={!step.localPath.trim() ? 'Local file path is required.' : undefined}
            match={true}
          >
            <Input
              required
              value={step.localPath}
              onChange={(event) => onChange({ ...step, localPath: event.target.value })}
              placeholder="/path/to/file"
              className="font-mono"
              spellCheck={false}
            />
          </FormItem>
          <FormItem
            name={`steps.${index}.remotePath`}
            label="Remote file path"
            invalid={!step.remotePath.trim()}
            error={!step.remotePath.trim() ? 'Remote file path is required.' : undefined}
            match={true}
          >
            <Input
              required
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
