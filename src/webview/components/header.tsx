import type { ReactNode } from 'react';
import { cn } from 'cn';

interface Props {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Header({ children, action, className }: Props) {
  return (
    <header className={cn('flex shrink-0 items-center justify-between px-3 py-2', className)}>
      <h2 className="text-sm font-semibold gap-2 flex items-center">{children}</h2>
      {action && <div className="font-mono text-xs text-(--vscode-descriptionForeground)">{action}</div>}
    </header>
  );
}
