import type { WorkflowStep } from '@/features/workflow/protocol';
import type { AssetSummary } from '@/features/assets/protocol';

export type WorkflowStepItem = {
  id: string;
  step: WorkflowStep;
};

export const workflowTypeOptions = [
  { value: 'local-command', label: 'Local command' },
  { value: 'sftp', label: 'SFTP transfer' },
  { value: 'ssh-command', label: 'SSH command' },
] as const;

export const directionOptions = [
  { value: 'upload', label: 'Upload local file to host' },
  { value: 'download', label: 'Download host file to local' },
];

let nextStepId = 0;

export function createStepItem(step: WorkflowStep): WorkflowStepItem {
  nextStepId += 1;
  return { id: `step-${nextStepId}`, step };
}

// Carries over fields the new operation shares with the previous one, so switching type keeps input.
export function convertStep(
  step: WorkflowStep | undefined,
  type: WorkflowStep['type'],
  defaultAssetId: string,
): WorkflowStep {
  if (step?.type === type) return step;
  const command = step && 'command' in step ? step.command : '';
  const assetId = step && 'assetId' in step && step.assetId ? step.assetId : defaultAssetId;
  if (type === 'local-command') return { type, command };
  if (type === 'ssh-command') return { type, assetId, command };
  return { type, assetId, direction: 'upload', localPath: '', remotePath: '' };
}

export function getStepTypeLabel(type: WorkflowStep['type']): string {
  return workflowTypeOptions.find((option) => option.value === type)?.label ?? type;
}

export function describeStep(step: WorkflowStep, hosts: readonly AssetSummary[]): string {
  if (step.type === 'local-command') return firstLine(step.command) || 'No command';
  const hostName = hosts.find((host) => host.type === 'ssh' && host.id === step.assetId)?.name ?? 'No host selected';
  if (step.type === 'ssh-command') return `${hostName} · ${firstLine(step.command) || 'No command'}`;
  const [from, to] =
    step.direction === 'upload' ? [step.localPath, step.remotePath] : [step.remotePath, step.localPath];
  return `${hostName} · ${from || '...'} → ${to || '...'}`;
}

export function isStepComplete(step: WorkflowStep, hosts: readonly AssetSummary[]): boolean {
  if (step.type === 'local-command') return step.command.trim() !== '';
  const hasHost = hosts.some((host) => host.type === 'ssh' && host.id === step.assetId);
  if (step.type === 'ssh-command') return hasHost && step.command.trim() !== '';
  return hasHost && step.localPath.trim() !== '' && step.remotePath.trim() !== '';
}

function firstLine(value: string): string {
  return value.trim().split('\n')[0] ?? '';
}
