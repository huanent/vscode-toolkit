import type { PlaybookStepResult } from '@/features/playbook/protocol';
import { Icon } from '@/webview/components/ui/icons';

interface PlaybookStatusIconProps {
  status: PlaybookStepResult['status'];
}

export function PlaybookStatusIcon({ status }: PlaybookStatusIconProps) {
  const icons = {
    pending: 'circle-outline',
    running: 'loading',
    completed: 'pass',
    failed: 'error',
    cancelled: 'circle-slash',
    skipped: 'debug-step-over',
  };
  const className =
    status === 'running'
      ? 'animate-spin text-(--vscode-progressBar-background)'
      : status === 'completed'
        ? 'text-(--vscode-testing-iconPassed)'
        : status === 'failed'
          ? 'text-(--vscode-errorForeground)'
          : 'text-(--vscode-descriptionForeground)';
  return <Icon name={icons[status]} className={className} />;
}
