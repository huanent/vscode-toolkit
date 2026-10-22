import type { PlaybookStep } from '@/features/playbook/protocol';
import type { AssetSummary } from '@/features/assets/protocol';

export type PlaybookStepItem = {
  id: string;
  step: PlaybookStep;
};

export const playbookTypeOptions = [
  { value: 'local-command', label: 'Local command' },
  { value: 'sftp', label: 'SFTP transfer' },
  { value: 'ssh-command', label: 'SSH command' },
] as const;

export const directionOptions = [
  { value: 'upload', label: 'Upload local file to host' },
  { value: 'download', label: 'Download host file to local' },
];

let nextStepId = 0;

export function createStepItem(step: PlaybookStep): PlaybookStepItem {
  nextStepId += 1;
  return { id: `step-${nextStepId}`, step };
}

// Carries over fields the new operation shares with the previous one, so switching type keeps input.
export function convertStep(
  step: PlaybookStep | undefined,
  type: PlaybookStep['type'],
  defaultAssetId: string,
): PlaybookStep {
  if (step?.type === type) return step;
  const name = step?.name ?? 'Step 1';
  const command = step && 'command' in step ? step.command : '';
  const assetId = step && 'assetId' in step && step.assetId ? step.assetId : defaultAssetId;
  if (type === 'local-command') return { type, name, command };
  if (type === 'ssh-command') return { type, name, assetId, command };
  return { type, name, assetId, direction: 'upload', localPath: '', remotePath: '' };
}

export function getStepTypeLabel(type: PlaybookStep['type']): string {
  return playbookTypeOptions.find((option) => option.value === type)?.label ?? type;
}

export function describeStep(step: PlaybookStep, hosts: readonly AssetSummary[]): string {
  if (step.type === 'local-command') return `${step.name} · ${firstLine(step.command) || 'No command'}`;
  const hostName = hosts.find((host) => host.type === 'ssh' && host.id === step.assetId)?.name ?? 'No host selected';
  if (step.type === 'ssh-command') return `${step.name} · ${hostName} · ${firstLine(step.command) || 'No command'}`;
  const [from, to] =
    step.direction === 'upload' ? [step.localPath, step.remotePath] : [step.remotePath, step.localPath];
  return `${step.name} · ${hostName} · ${from || '...'} → ${to || '...'}`;
}

export function isStepComplete(step: PlaybookStep, hosts: readonly AssetSummary[]): boolean {
  if (!step.name.trim()) return false;
  if (step.type === 'local-command') return step.command.trim() !== '';
  const hasHost = hosts.some((host) => host.type === 'ssh' && host.id === step.assetId);
  if (step.type === 'ssh-command') return hasHost && step.command.trim() !== '';
  return hasHost && step.localPath.trim() !== '' && step.remotePath.trim() !== '';
}

function firstLine(value: string): string {
  return value.trim().split('\n')[0] ?? '';
}
