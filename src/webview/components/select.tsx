import { Select as BaseSelect } from '@base-ui/react/select';
import type { SelectRootProps } from '@base-ui/react/select';
import { cn } from 'cn';
import { Icon } from '@/webview/components/icons';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectProps = Omit<SelectRootProps<string>, 'children' | 'items' | 'onValueChange' | 'value'> & {
  options: readonly SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
};

export function Select({
  options,
  value,
  onValueChange,
  placeholder = 'Select an option',
  className,
  'aria-label': ariaLabel,
  ...rootProps
}: SelectProps) {
  return (
    <BaseSelect.Root
      {...rootProps}
      items={options}
      value={value ?? null}
      onValueChange={(nextValue) => onValueChange?.(nextValue ?? '')}
    >
      <BaseSelect.Trigger
        type="button"
        aria-label={ariaLabel}
        className={cn(
          'flex h-7 w-full min-w-0 items-center justify-between gap-2 rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 text-left text-sm text-(--vscode-input-foreground) focus:border-(--vscode-focusBorder) focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <BaseSelect.Value
          placeholder={placeholder}
          className="min-w-0 flex-1 truncate data-placeholder:text-(--vscode-input-placeholderForeground)"
        />
        <BaseSelect.Icon className="shrink-0 text-(--vscode-descriptionForeground)">
          <Icon name="chevron-down" size="sm" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner align="start" sideOffset={4} className="z-50 w-(--anchor-width) outline-none">
          <BaseSelect.Popup className="max-h-60 w-full overflow-y-auto rounded-sm border border-(--vscode-widget-border,var(--vscode-panel-border)) bg-(--vscode-editorWidget-background,var(--vscode-editor-background)) py-1 text-(--vscode-foreground) shadow-sm">
            <BaseSelect.List>
              {options.map((item) => (
                <BaseSelect.Item
                  key={item.value}
                  value={item.value}
                  disabled={item.disabled}
                  className="flex min-w-0 cursor-pointer items-center justify-between gap-2 px-2 py-1.5 outline-none data-highlighted:bg-(--vscode-list-activeSelectionBackground) data-highlighted:text-(--vscode-list-activeSelectionForeground) data-disabled:cursor-not-allowed data-disabled:opacity-50"
                >
                  <BaseSelect.ItemText className="min-w-0 truncate">{item.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator>
                    <Icon name="check" size="sm" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
