import { cn } from 'cn';

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
      <span
        aria-hidden="true"
        className="relative size-4 shrink-0 text-(--vscode-progressBar-background,var(--vscode-focusBorder))"
      >
        <span className="absolute inset-0 rounded-full border-2 border-current opacity-25" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-r-current motion-reduce:animate-none" />
      </span>
      <span className="min-w-0 wrap-break-word">{label}</span>
    </div>
  );
}
