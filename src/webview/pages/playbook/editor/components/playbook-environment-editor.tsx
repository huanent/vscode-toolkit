import { useState } from 'react';
import type { PlaybookEnvironmentVariable } from '@/features/playbook/protocol';
import { Button } from '@/webview/components/ui/button';
import { Collapsible } from '@/webview/components/ui/collapsible';
import { Icon } from '@/webview/components/ui/icons';
import { PlaybookEnvironmentFields } from './playbook-environment-fields';

export function PlaybookEnvironmentEditor({
  environment,
  onChange,
}: {
  environment: PlaybookEnvironmentVariable[];
  onChange: (environment: PlaybookEnvironmentVariable[]) => void;
}) {
  const [ids, setIds] = useState(() => environment.map(() => crypto.randomUUID()));
  return (
    <section aria-label="Environment variables" className="flex min-w-0 flex-col">
      {environment.map((variable, index) => (
        <Collapsible
          key={ids[index]}
          defaultOpen
          title={
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="min-w-0 truncate font-mono">{variable.name || `Variable ${index + 1}`}</span>
              <span className="shrink-0 text-xs font-normal text-(--vscode-descriptionForeground)">
                {variable.type}
              </span>
            </div>
          }
          actions={
            <Button
              variant="ghost"
              title="Remove variable"
              aria-label={`Remove variable ${index + 1}`}
              prefix={<Icon name="trash" />}
              onClick={() => {
                setIds(ids.filter((_, currentIndex) => currentIndex !== index));
                onChange(environment.filter((_, currentIndex) => currentIndex !== index));
              }}
            />
          }
        >
          <PlaybookEnvironmentFields
            index={index}
            variable={variable}
            existingNames={environment
              .filter((_, currentIndex) => currentIndex !== index)
              .map((current) => current.name)}
            onChange={(next) =>
              onChange(environment.map((current, currentIndex) => (currentIndex === index ? next : current)))
            }
          />
        </Collapsible>
      ))}
      <div>
        <Button
          variant="secondary"
          prefix={<Icon name="add" />}
          onClick={() => {
            setIds([...ids, crypto.randomUUID()]);
            onChange([...environment, { name: '', label: '', type: 'input', defaultValue: '' }]);
          }}
        >
          Add variable
        </Button>
      </div>
    </section>
  );
}
