import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  action?: ReactNode;
}

export function Header({ children, action }: Props) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-(--vscode-panel-border) px-3 py-2">
      <h2 className="text-sm font-semibold gap-2 flex items-center">{children}</h2>
      {action && <div className="font-mono text-xs text-(--vscode-descriptionForeground)">{action}</div>}
    </header>
  );
}
