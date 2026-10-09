import type { ReactNode } from 'react';
import { cn } from 'cn';

interface Props {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Header({ children, action, className }: Props) {
  return (
    <header className={cn('flex min-h-8 shrink-0 items-center justify-between gap-2 px-3 py-1', className)}>
      <h2 className="flex min-w-0 items-center gap-2 wrap-break-word text-xs font-semibold">{children}</h2>
      {action && (
        <div className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-(--vscode-descriptionForeground)">
          {action}
        </div>
      )}
    </header>
  );
}
