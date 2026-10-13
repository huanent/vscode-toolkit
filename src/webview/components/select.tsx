import { Select as BaseSelect, type SelectRootProps } from '@base-ui/react/select';
import { cn } from 'cn';
import { Icon } from '@/webview/components/icons';
import { fieldClassName, popupClassName, popupItemClassName } from '@/webview/components/surface-styles';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = Omit<SelectRootProps<string>, 'children' | 'items' | 'onValueChange' | 'value'> & {
  options: readonly SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

const scrollArrowClassName =
  'z-10 flex w-full items-center justify-center bg-(--vscode-editorWidget-background,var(--vscode-editor-background)) text-(--vscode-descriptionForeground)';

export function Select({
  options,
  value,
  onValueChange,
  placeholder = 'Select an option',
  className,
  ariaLabel,
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
          fieldClassName,
          'flex cursor-pointer items-center justify-between gap-2 text-left select-none data-popup-open:border-(--vscode-focusBorder)',
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
        <BaseSelect.Positioner align="start" alignItemWithTrigger={false} side="bottom" sideOffset={4} className="z-50">
          <BaseSelect.Popup
            className={cn(
              popupClassName,
              'relative w-max min-w-(--anchor-width) max-w-(--available-width) overflow-hidden',
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
                    className={popupItemClassName}
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
