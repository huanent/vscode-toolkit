import { cn } from 'cn';
import { Icon } from '@/webview/components/icons';

type LoadingProps = {
  label: string;
  className?: string;
};

export function Loading({ label, className }: LoadingProps) {
  return (
    <div
      className={cn('inline-flex items-center gap-2 text-(--vscode-descriptionForeground)', className)}
      role="status"
      aria-live="polite"
    >
      <Icon name="loading" size="md" className="codicon-modifier-spin" />
      <span>{label}</span>
    </div>
  );
}
