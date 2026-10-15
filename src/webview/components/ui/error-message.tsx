import { cn } from 'cn';
import { Icon } from '@/webview/components/ui/icons';

type ErrorMessageProps = {
  message: string;
  className?: string;
};

export function ErrorMessage({ message, className }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex min-w-0 items-start gap-2 rounded-sm border border-(--vscode-inputValidation-errorBorder) bg-(--vscode-inputValidation-errorBackground) p-2 text-(--vscode-errorForeground)',
        className,
      )}
    >
      <Icon name="error" size="sm" />
      <span className="min-w-0 wrap-break-word">{message}</span>
    </div>
  );
}
