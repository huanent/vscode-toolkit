import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import type { ReactNode } from 'react';

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  options: readonly { value: T; label: ReactNode; disabled?: boolean }[];
  value: T;
  onValueChange: (value: T) => void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  options,
  value,
  onValueChange,
  disabled,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      value={[value]}
      disabled={disabled}
      onValueChange={(values) => {
        const option = options.find((item) => item.value === values[0]);
        if (option) onValueChange(option.value);
      }}
      className="flex shrink-0 items-center rounded border border-(--vscode-panel-border) p-px"
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className="cursor-pointer rounded px-2 py-1 text-xs text-(--vscode-foreground) hover:bg-(--vscode-list-hoverBackground) data-pressed:bg-(--vscode-list-activeSelectionBackground) data-pressed:text-(--vscode-list-activeSelectionForeground) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
