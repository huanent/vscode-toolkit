import { Collapsible } from '@/webview/components/collapsible';

interface HttpHeadersProps {
  headers: Record<string, string>;
}

export function HttpHeaders({ headers }: HttpHeadersProps) {
  const entries = Object.entries(headers);

  return (
    <Collapsible title={`Headers (${entries.length})`} className="min-w-0">
      <div className="text-(--vscode-descriptionForeground) pl-3">
        {entries.length === 0 ? (
          <div className="py-2 text-sm text-(--vscode-descriptionForeground)">No headers</div>
        ) : (
          <dl>
            {entries.map(([name, value]) => (
              <div
                key={name}
                className="grid grid-cols-1 gap-1 border-b border-(--vscode-panel-border) py-2 text-xs sm:grid-cols-3 sm:gap-2"
              >
                <dt className="col-span-1 min-w-0 break-all font-mono font-semibold">{name}</dt>
                <dd className="min-w-0 break-all font-mono select-text sm:col-span-2">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Collapsible>
  );
}
