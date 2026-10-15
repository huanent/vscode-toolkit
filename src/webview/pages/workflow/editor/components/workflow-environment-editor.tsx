import { useState } from 'react';
import type { WorkflowEnvironmentVariable } from '@/features/workflow/protocol';
import { Button } from '@/webview/components/ui/button';
import { Icon } from '@/webview/components/ui/icons';
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
    <section aria-label="Environment variables" className="min-w-0">
      <header className="flex h-8 items-center justify-between gap-2 border-b border-(--vscode-panel-border) px-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase">
          Environment variables
          <span className="font-normal text-(--vscode-descriptionForeground)">{environment.length}</span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          title="Add variable"
          aria-label="Add variable"
          prefix={<Icon name="add" />}
          onClick={() =>
            setEditing({
              variable: { name: '', label: '', type: 'input', defaultValue: '' },
            })
          }
        />
      </header>
      {environment.length === 0 && (
        <p className="px-3 py-2 text-(--vscode-descriptionForeground)">No environment variables</p>
      )}
      <div className="divide-y divide-(--vscode-panel-border)">
        {environment.map((variable, index) => (
          <div
            key={index}
            className="flex min-w-0 items-center gap-2 px-3 py-1 hover:bg-(--vscode-list-hoverBackground)"
          >
            <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2 sm:gap-3">
              <div className="grid min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="wrap-anywhere font-mono font-medium">{variable.name}</span>
                  <span className="text-xs text-(--vscode-descriptionForeground)">{variable.type}</span>
                </div>
                {variable.label && (
                  <span className="wrap-anywhere text-xs text-(--vscode-descriptionForeground)">{variable.label}</span>
                )}
              </div>
              <div className="min-w-0">
                <span title="Default value" className="wrap-anywhere font-mono text-xs">
                  {(variable.type === 'select'
                    ? variable.options.find((option) => option.value === variable.defaultValue)?.label
                    : String(variable.defaultValue)) || 'Not set'}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                title="Edit variable"
                aria-label={`Edit ${variable.name}`}
                prefix={<Icon name="edit" />}
                onClick={() => setEditing({ index, variable })}
              />
              <Button
                variant="ghost"
                size="sm"
                title="Remove variable"
                aria-label={`Remove ${variable.name}`}
                prefix={<Icon name="trash" />}
                onClick={() => onChange(environment.filter((_, currentIndex) => currentIndex !== index))}
              />
            </div>
          </div>
        ))}
      </div>
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
