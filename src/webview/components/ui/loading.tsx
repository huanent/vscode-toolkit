import { cn } from 'cn';
import { Icon } from '@/webview/components/ui/icons';

type LoadingProps = {
  label: string;
  className?: string;
};

export function Loading({ label, className }: LoadingProps) {
  return (
    <div
      className={cn('inline-flex min-w-0 items-center gap-2 text-(--vscode-descriptionForeground)', className)}
      role="status"
      aria-live="polite"
    >
      <Icon name="loading" size="lg" className="codicon-modifier-spin" />
      <span className="min-w-0 wrap-break-word">{label}</span>
    </div>
  );
}
