import type { WorkflowEnvironmentVariable } from '@/features/workflow/protocol';
import { Button } from '@/webview/components/ui/button';
import { Checkbox } from '@/webview/components/ui/checkbox';
import { FormItem } from '@/webview/components/ui/form';
import { Icon } from '@/webview/components/ui/icons';
import { Input } from '@/webview/components/ui/input';
import { Select } from '@/webview/components/ui/select';

const controlOptions = [
  { value: 'input', label: 'Input' },
  { value: 'select', label: 'Select' },
  { value: 'checkbox', label: 'Checkbox' },
];

export function WorkflowEnvironmentFields({
  variable,
  existingNames,
  index,
  onChange,
}: {
  variable: WorkflowEnvironmentVariable;
  existingNames: string[];
  index: number;
  onChange: (variable: WorkflowEnvironmentVariable) => void;
}) {
  const draft = variable;
  const setDraft = onChange;
  const validName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(draft.name);
  const duplicate = existingNames.some((name) => name.toUpperCase() === draft.name.toUpperCase());
  const validOptions =
    draft.type !== 'select' ||
    (draft.options.length > 0 &&
      draft.options.every((option) => option.value.trim() && option.label.trim() && !option.value.includes('\0')) &&
      new Set(draft.options.map((option) => option.value)).size === draft.options.length &&
      draft.options.some((option) => option.value === draft.defaultValue));
  return (
    <div className="grid min-w-0 gap-5 pb-3">
      <FormItem
        name={`environment.${index}.name`}
        label="Variable name"
        invalid={!validName || duplicate}
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
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </FormItem>
      <FormItem name={`environment.${index}.label`} label="Label">
        <Input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
      </FormItem>
      <FormItem name={`environment.${index}.type`} label="Control">
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
          {draft.options.map((option, optionIndex) => (
            <div key={optionIndex} className="flex min-w-0 items-end gap-2">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <FormItem name={`environment.${index}.options.${optionIndex}.value`} label="Value">
                  <Input
                    value={option.value}
                    aria-label={`Option ${optionIndex + 1} value`}
                    required
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        options: draft.options.map((current, currentIndex) =>
                          currentIndex === optionIndex ? { ...current, value: event.target.value } : current,
                        ),
                        defaultValue: draft.defaultValue === option.value ? event.target.value : draft.defaultValue,
                      })
                    }
                  />
                </FormItem>
                <FormItem name={`environment.${index}.options.${optionIndex}.label`} label="Label">
                  <Input
                    value={option.label}
                    aria-label={`Option ${optionIndex + 1} label`}
                    required
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        options: draft.options.map((current, currentIndex) =>
                          currentIndex === optionIndex ? { ...current, label: event.target.value } : current,
                        ),
                      })
                    }
                  />
                </FormItem>
              </div>
              <Button
                variant="ghost"
                title="Remove option"
                aria-label={`Remove option ${optionIndex + 1}`}
                disabled={draft.options.length === 1}
                prefix={<Icon name="trash" />}
                onClick={() => {
                  const options = draft.options.filter((_, currentIndex) => currentIndex !== optionIndex);
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
      <FormItem name={`environment.${index}.defaultValue`} label="Default value">
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
    </div>
  );
}
