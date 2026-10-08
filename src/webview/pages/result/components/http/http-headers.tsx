import type { ReactNode } from 'react';
import { Collapsible } from '@/webview/components/collapsible';

interface HttpHeadersProps {
  headers: Record<string, string>;
  action?: ReactNode;
}

export function HttpHeaders({ headers, action }: HttpHeadersProps) {
  const entries = Object.entries(headers);

  return (
    <div className="flex items-start justify-between gap-3">
      <Collapsible title="Headers" className="min-w-0 flex-1">
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
      </Collapsible>
      {action}
    </div>
  );
}
