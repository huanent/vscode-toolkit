import { useId, useState } from 'react';
import type { WorkflowEnvironmentVariable } from '@/features/workflow/protocol';
import { Button } from '@/webview/components/button';
import { Checkbox } from '@/webview/components/checkbox';
import { Dialog } from '@/webview/components/dialog';
import { Form, FormItem } from '@/webview/components/form';
import { Icon } from '@/webview/components/icons';
import { Input } from '@/webview/components/input';
import { Select } from '@/webview/components/select';

const controlOptions = [
  { value: 'input', label: 'Input' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
];

export function WorkflowEnvironmentDialog({
  variable,
  existingNames,
  editing,
  onClose,
  onSave,
}: {
  variable: WorkflowEnvironmentVariable;
  existingNames: string[];
  editing: boolean;
  onClose: () => void;
  onSave: (variable: WorkflowEnvironmentVariable) => void;
}) {
  const formId = useId();
  const [draft, setDraft] = useState(variable);
  const validName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(draft.name);
  const duplicate = existingNames.some((name) => name.toUpperCase() === draft.name.toUpperCase());
  const validOptions =
    draft.type !== 'select' ||
    (draft.options.length > 0 &&
      draft.options.every((option) => option.value.trim() && option.label.trim() && !option.value.includes('\0')) &&
      new Set(draft.options.map((option) => option.value)).size === draft.options.length &&
      draft.options.some((option) => option.value === draft.defaultValue));
  const valid =
    validName &&
    !duplicate &&
    validOptions &&
    (typeof draft.defaultValue !== 'string' || !draft.defaultValue.includes('\0'));
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={editing ? 'Edit environment variable' : 'Add environment variable'}
      form={formId}
      saveDisabled={!valid}
    >
      <Form
        id={formId}
        className="grid gap-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (valid) onSave(draft);
        }}
      >
        <FormItem
          name="variableName"
          label="Variable name"
          match={true}
          error={
            !validName
              ? 'Use letters, digits, and underscores; start with a letter or underscore.'
              : duplicate
                ? 'Variable names must be unique.'
                : undefined
          }
        >
          <Input
            value={draft.name}
            required
            pattern="[A-Za-z_][A-Za-z0-9_]*"
            aria-invalid={!validName || duplicate}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </FormItem>
        <FormItem name="variableLabel" label="Label">
          <Input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
        </FormItem>
        <FormItem name="variableType" label="Control">
          <Select
            value={draft.type}
            options={controlOptions}
            onValueChange={(type) => {
              const common = { name: draft.name, label: draft.label };
              if (type === 'input') setDraft({ ...common, type, defaultValue: String(draft.defaultValue) });
              if (type === 'checkbox')
                setDraft({
                  ...common,
                  type,
                  defaultValue: draft.defaultValue === true || draft.defaultValue === 'true',
                });
              if (type === 'select') {
                const value = String(draft.defaultValue) || 'option-1';
                setDraft({ ...common, type, defaultValue: value, options: [{ value, label: value }] });
              }
            }}
          />
        </FormItem>
        {draft.type === 'select' && (
          <div className="grid min-w-0 gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium">Options</h3>
              <Button
                variant="ghost"
                title="Add option"
                aria-label="Add option"
                prefix={<Icon name="add" />}
                onClick={() => setDraft({ ...draft, options: [...draft.options, { value: '', label: '' }] })}
              />
            </div>
            {draft.options.map((option, index) => (
              <div key={index} className="flex min-w-0 items-end gap-2">
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  <FormItem name={`options.${index}.value`} label="Value">
                    <Input
                      value={option.value}
                      aria-label={`Option ${index + 1} value`}
                      required
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          options: draft.options.map((current, currentIndex) =>
                            currentIndex === index ? { ...current, value: event.target.value } : current,
                          ),
                          defaultValue: draft.defaultValue === option.value ? event.target.value : draft.defaultValue,
                        })
                      }
                    />
                  </FormItem>
                  <FormItem name={`options.${index}.label`} label="Label">
                    <Input
                      value={option.label}
                      aria-label={`Option ${index + 1} label`}
                      required
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          options: draft.options.map((current, currentIndex) =>
                            currentIndex === index ? { ...current, label: event.target.value } : current,
                          ),
                        })
                      }
                    />
                  </FormItem>
                </div>
                <Button
                  variant="ghost"
                  title="Remove option"
                  aria-label={`Remove option ${index + 1}`}
                  disabled={draft.options.length === 1}
                  prefix={<Icon name="trash" />}
                  onClick={() => {
                    const options = draft.options.filter((_, currentIndex) => currentIndex !== index);
                    setDraft({
                      ...draft,
                      options,
                      defaultValue: options.some((current) => current.value === draft.defaultValue)
                        ? draft.defaultValue
                        : options[0].value,
                    });
                  }}
                />
              </div>
            ))}
            {!validOptions && (
              <p role="alert" className="text-(--vscode-errorForeground)">
                Options need unique, non-empty values and non-empty labels.
              </p>
            )}
          </div>
        )}
        <FormItem name="variableDefault" label="Default value">
          {draft.type === 'checkbox' ? (
            <Checkbox
              checked={draft.defaultValue}
              onCheckedChange={(defaultValue) => setDraft({ ...draft, defaultValue })}
            />
          ) : draft.type === 'select' ? (
            <Select
              value={draft.defaultValue}
              options={draft.options.filter(
                (option, index, options) =>
                  option.value.trim() && options.findIndex((current) => current.value === option.value) === index,
              )}
              onValueChange={(defaultValue) => setDraft({ ...draft, defaultValue })}
            />
          ) : (
            <Input
              value={draft.defaultValue}
              onChange={(event) => setDraft({ ...draft, defaultValue: event.target.value })}
            />
          )}
        </FormItem>
      </Form>
    </Dialog>
  );
}
