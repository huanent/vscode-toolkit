import type { ReactNode } from 'react';

interface HeadersProps {
  headers: Record<string, string>;
  action?: ReactNode;
}

export function Headers({ headers, action }: HeadersProps) {
  const entries = Object.entries(headers);

  return (
    <div className="flex items-start justify-between gap-3">
      <details className="group min-w-0 flex-1">
        <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-left text-xs font-semibold text-(--vscode-foreground)">
          <span className="inline-block transition-transform group-open:rotate-90">›</span>
          Headers
        </summary>
        <div className="text-(--vscode-descriptionForeground) pl-3">
          {entries.length === 0 ? (
            <div className="py-2 text-sm text-(--vscode-descriptionForeground)">No headers</div>
          ) : (
            <dl>
              {entries.map(([name, value]) => (
                <div key={name} className="grid grid-cols-3 gap-2 py-1 text-xs">
                  <dt className="col-span-1 min-w-0 break-all font-mono font-semibold">{name}</dt>
                  <dd className="col-span-2 min-w-0 break-all font-mono">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </details>
      {action}
    </div>
  );
}
