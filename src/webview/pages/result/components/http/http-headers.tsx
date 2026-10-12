import { Collapsible } from '@/webview/components/collapsible';
import { Fragment } from 'react';
import './http-headers.css';

interface HttpHeadersProps {
  headers: Record<string, string>;
}

export function HttpHeaders({ headers }: HttpHeadersProps) {
  const entries = Object.entries(headers);

  return (
    <Collapsible title={`Headers (${entries.length})`} className="min-w-0">
      <div className="text-(--vscode-descriptionForeground) pl-3">
        {entries.length === 0 ? (
          <div className="py-2  text-(--vscode-descriptionForeground)">No headers</div>
        ) : (
          <dl className="http-headers-grid ">
            {entries.map(([name, value]) => (
              <Fragment key={name}>
                <dt className="break-all font-semibold">{name}</dt>
                <dd className="min-w-0 break-all font-normal select-text">{value}</dd>
              </Fragment>
            ))}
          </dl>
        )}
      </div>
    </Collapsible>
  );
}
