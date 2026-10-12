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

const popupSurface =
  'border-(--vscode-widget-border,var(--vscode-panel-border)) bg-(--vscode-editorWidget-background,var(--vscode-editor-background)) text-(--vscode-foreground)';

const scrollArrowClassName =
  'z-10 flex h-6 w-full items-center justify-center bg-(--vscode-editorWidget-background,var(--vscode-editor-background)) text-(--vscode-descriptionForeground)';

export function Select({
  options,
  value,
  onValueChange,
  placeholder = 'Select an option',
  className,
  'aria-label': ariaLabel,
  modal = false,
  ...rootProps
}: SelectProps) {
  return (
    <BaseSelect.Root
      {...rootProps}
      modal={modal}
      items={options}
      value={value ?? null}
      onValueChange={(nextValue) => onValueChange?.(nextValue ?? '')}
    >
      <BaseSelect.Trigger
        type="button"
        aria-label={ariaLabel}
        className={cn(
          'flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-sm border border-(--vscode-input-border,transparent) bg-(--vscode-input-background) px-2 py-1 text-left text-sm text-(--vscode-input-foreground) select-none focus:border-(--vscode-focusBorder) focus:outline-none data-invalid:border-(--vscode-inputValidation-errorBorder) data-popup-open:border-(--vscode-focusBorder) disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-(--vscode-inputValidation-errorBorder)',
          className,
        )}
      >
        <BaseSelect.Value
          placeholder={placeholder}
          className="min-w-0 flex-1 truncate data-placeholder:text-(--vscode-input-placeholderForeground)"
        />
        <BaseSelect.Icon className="flex shrink-0 text-(--vscode-descriptionForeground) transition-transform data-popup-open:rotate-180">
          <Icon name="chevron-down" size="sm" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          align="start"
          alignItemWithTrigger={false}
          side="bottom"
          sideOffset={4}
          className="z-50 outline-none"
        >
          <BaseSelect.Popup
            className={cn(
              'relative w-max min-w-(--anchor-width) max-w-(--available-width) overflow-hidden rounded-sm border text-sm shadow-sm outline-none',
              popupSurface,
            )}
          >
            <BaseSelect.ScrollUpArrow className={cn('top-0', scrollArrowClassName)}>
              <Icon name="chevron-up" size="sm" />
            </BaseSelect.ScrollUpArrow>
            <BaseSelect.List className="max-h-(--available-height) scroll-py-6 overflow-y-auto py-1">
              {options.length === 0 ? (
                <div className="px-2 py-1 text-(--vscode-descriptionForeground)">No options</div>
              ) : (
                options.map((item) => (
                  <BaseSelect.Item
                    key={item.value}
                    value={item.value}
                    label={item.label}
                    disabled={item.disabled}
                    title={item.label}
                    className="flex min-w-0 cursor-pointer items-center gap-2 px-2 py-1 outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-(--vscode-list-activeSelectionBackground) data-highlighted:text-(--vscode-list-activeSelectionForeground)"
                  >
                    <span className="flex w-4 shrink-0 items-center justify-center">
                      <BaseSelect.ItemIndicator className="flex items-center justify-center">
                        <Icon name="check" size="sm" />
                      </BaseSelect.ItemIndicator>
                    </span>
                    <BaseSelect.ItemText className="min-w-0 flex-1 truncate">{item.label}</BaseSelect.ItemText>
                  </BaseSelect.Item>
                ))
              )}
            </BaseSelect.List>
            <BaseSelect.ScrollDownArrow className={cn('bottom-0', scrollArrowClassName)}>
              <Icon name="chevron-down" size="sm" />
            </BaseSelect.ScrollDownArrow>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
