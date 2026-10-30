import { cn } from 'cn';
import { glassBackdropClassName } from '@/webview/components/ui/surface-styles';

type LoadingProps = {
  label: string;
  className?: string;
  full?: boolean;
};

export function Loading({ label, className, full = false }: LoadingProps) {
  return (
    <div
      className={cn(
        'inline-flex min-w-0 items-center gap-2 text-(--vscode-descriptionForeground)',
        full && 'absolute inset-0 z-10 justify-center',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {full && <div aria-hidden="true" className={cn('absolute inset-0 backdrop-blur-sm', glassBackdropClassName)} />}
      <span
        aria-hidden="true"
        className="relative size-4 shrink-0 text-(--vscode-progressBar-background,var(--vscode-focusBorder))"
      >
        <span className="absolute inset-0 rounded-full border-2 border-current opacity-25" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-current motion-reduce:animate-none" />
      </span>
      <span className={cn('min-w-0 wrap-break-word', full && 'relative')}>{label}</span>
    </div>
  );
}
