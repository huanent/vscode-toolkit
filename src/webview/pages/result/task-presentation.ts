import type { ResultTaskStatus } from '@/features/result/protocol';

export const taskStatusPresentation: Record<ResultTaskStatus, { label: string; icon: string; className: string }> = {
  running: { label: 'Running', icon: 'loading', className: 'text-(--vscode-progressBar-background)' },
  completed: { label: 'Completed', icon: 'check', className: 'text-(--vscode-testing-iconPassed)' },
  failed: { label: 'Failed', icon: 'error', className: 'text-(--vscode-errorForeground)' },
  cancelled: { label: 'Cancelled', icon: 'circle-slash', className: 'text-(--vscode-descriptionForeground)' },
  interrupted: { label: 'Interrupted', icon: 'debug-pause', className: 'text-(--vscode-editorWarning-foreground)' },
};

export function formatTaskKind(kind: string): string {
  return kind === 'http' ? 'HTTP' : kind === 'sqlite' ? 'SQLite' : kind;
}

export function formatTaskDuration(durationMs: number): string {
  const duration = Math.max(0, durationMs);
  return duration < 1000 ? `${duration} ms` : `${(duration / 1000).toFixed(2)} s`;
}
