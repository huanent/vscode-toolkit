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
      className="inline-flex max-w-full shrink-0 items-center overflow-x-auto rounded-sm border border-(--vscode-panel-border) p-px"
    >
      {options.map((option) => (
        <Toggle
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className="inline-flex h-6 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-sm px-2 text-xs text-(--vscode-foreground) enabled:hover:bg-(--vscode-list-hoverBackground) data-pressed:bg-(--vscode-list-activeSelectionBackground) data-pressed:text-(--vscode-list-activeSelectionForeground) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {option.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
