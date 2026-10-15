import { useState } from 'react';
import type { WorkflowEnvironmentVariable } from '@/features/workflow/protocol';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { WorkflowEnvironmentDialog } from './workflow-environment-dialog';

export function WorkflowEnvironmentEditor({
  environment,
  onChange,
}: {
  environment: WorkflowEnvironmentVariable[];
  onChange: (environment: WorkflowEnvironmentVariable[]) => void;
}) {
  const [editing, setEditing] = useState<{ index?: number; variable: WorkflowEnvironmentVariable }>();
  return (
    <section aria-label="Environment variables" className="grid gap-3 border-b border-(--vscode-panel-border) p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Environment variables</h2>
        <Button
          variant="secondary"
          prefix={<Icon name="add" />}
          onClick={() =>
            setEditing({
              variable: { name: '', label: '', type: 'input', defaultValue: '' },
            })
          }
        >
          Add variable
        </Button>
      </header>
      {environment.map((variable, index) => (
        <div key={index} className="flex min-w-0 items-center gap-3 border-t border-(--vscode-panel-border) pt-3">
          <div className="grid min-w-0 flex-1 gap-1">
            <span className="wrap-anywhere font-mono">{variable.name}</span>
            <span className="wrap-anywhere text-xs text-(--vscode-descriptionForeground)">
              {variable.label || variable.name} · {variable.type} ·{' '}
              {variable.type === 'select'
                ? variable.options.find((option) => option.value === variable.defaultValue)?.label
                : String(variable.defaultValue)}
            </span>
          </div>
          <Button
            variant="ghost"
            title="Edit variable"
            aria-label={`Edit ${variable.name}`}
            prefix={<Icon name="edit" />}
            onClick={() => setEditing({ index, variable })}
          />
          <Button
            variant="ghost"
            title="Remove variable"
            aria-label={`Remove ${variable.name}`}
            prefix={<Icon name="trash" />}
            onClick={() => onChange(environment.filter((_, currentIndex) => currentIndex !== index))}
          />
        </div>
      ))}
      {editing && (
        <WorkflowEnvironmentDialog
          variable={editing.variable}
          existingNames={environment.filter((_, index) => index !== editing.index).map((variable) => variable.name)}
          editing={editing.index !== undefined}
          onClose={() => setEditing(undefined)}
          onSave={(variable) => {
            onChange(
              editing.index === undefined
                ? [...environment, variable]
                : environment.map((current, index) => (index === editing.index ? variable : current)),
            );
            setEditing(undefined);
          }}
        />
      )}
    </section>
  );
}
