import type { WorkflowSshConnection, WorkflowStep } from '@/features/workflow/protocol';

export type WorkflowStepItem = {
  id: string;
  step: WorkflowStep;
  expanded: boolean;
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

export function createStepItem(step: WorkflowStep, expanded: boolean): WorkflowStepItem {
  nextStepId += 1;
  return { id: `step-${nextStepId}`, step, expanded };
}

// Carries over fields the new operation shares with the previous one, so switching type keeps input.
export function convertStep(
  step: WorkflowStep | undefined,
  type: WorkflowStep['type'],
  defaultHostId: string,
): WorkflowStep {
  const command = step && 'command' in step ? step.command : '';
  const hostId = step && 'hostId' in step && step.hostId ? step.hostId : defaultHostId;
  if (type === 'local-command') return { type, command };
  if (type === 'ssh-command') return { type, hostId, command };
  return { type, hostId, direction: 'upload', localPath: '', remotePath: '' };
}

export function getStepTypeLabel(type: WorkflowStep['type']): string {
  return workflowTypeOptions.find((option) => option.value === type)?.label ?? type;
}

export function describeStep(step: WorkflowStep, hosts: readonly WorkflowSshConnection[]): string {
  if (step.type === 'local-command') return firstLine(step.command) || 'No command';
  const hostName = hosts.find((host) => host.id === step.hostId)?.name ?? 'No host selected';
  if (step.type === 'ssh-command') return `${hostName} · ${firstLine(step.command) || 'No command'}`;
  const [from, to] =
    step.direction === 'upload' ? [step.localPath, step.remotePath] : [step.remotePath, step.localPath];
  return `${hostName} · ${from || '...'} → ${to || '...'}`;
}

export function isStepComplete(step: WorkflowStep): boolean {
  if (step.type === 'local-command') return step.command.trim() !== '';
  if (step.type === 'ssh-command') return step.hostId !== '' && step.command.trim() !== '';
  return step.hostId !== '' && step.localPath.trim() !== '' && step.remotePath.trim() !== '';
}

function firstLine(value: string): string {
  return value.trim().split('\n')[0] ?? '';
}
