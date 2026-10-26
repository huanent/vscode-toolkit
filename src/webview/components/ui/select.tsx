import { Select as BaseSelect, type SelectRootProps } from '@base-ui/react/select';
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Icon } from '@/webview/components/ui/icons';
import { fieldClassName, popupClassName, popupItemClassName } from '@/webview/components/ui/surface-styles';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
};

export type SelectProps = Omit<SelectRootProps<string>, 'children' | 'items' | 'onValueChange' | 'value'> & {
  options: readonly SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  prefix?: ReactNode;
  variant?: 'field' | 'toolbar';
  side?: 'top' | 'bottom';
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
  prefix,
  variant = 'field',
  side = 'bottom',
  modal = false,
  ...rootProps
}: SelectProps) {
  const groups = new Map<string, SelectOption[]>();
  for (const option of options) {
    const name = option.group ?? '';
    const items = groups.get(name);
    if (items) items.push(option);
    else groups.set(name, [option]);
  }

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
        title={options.find((option) => option.value === value)?.label || placeholder}
        className={cn(
          variant === 'field'
            ? fieldClassName
            : 'h-6 min-w-0 rounded-sm border border-transparent bg-transparent px-1 text-(--vscode-descriptionForeground) hover:bg-(--vscode-toolbar-hoverBackground) hover:text-(--vscode-foreground) disabled:cursor-not-allowed disabled:opacity-50',
          'flex cursor-pointer items-center justify-between gap-2 text-left select-none data-popup-open:border-(--vscode-focusBorder)',
          className,
        )}
      >
        {prefix != null && (
          <div aria-hidden="true" className="flex shrink-0 items-center">
            {prefix}
          </div>
        )}
        <BaseSelect.Value
          placeholder={placeholder}
          className="min-w-0 flex-1 truncate data-placeholder:text-(--vscode-input-placeholderForeground)"
        />
        <BaseSelect.Icon className="flex shrink-0 text-(--vscode-descriptionForeground) transition-transform data-popup-open:rotate-180">
          <Icon name="chevron-down" size="sm" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner align="start" alignItemWithTrigger={false} side={side} sideOffset={4} className="z-50">
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
                Array.from(groups, ([name, items]) => (
                  <BaseSelect.Group key={name}>
                    {name && (
                      <BaseSelect.GroupLabel className="px-2 pb-1 pt-2 text-xs font-semibold text-(--vscode-descriptionForeground)">
                        {name}
                      </BaseSelect.GroupLabel>
                    )}
                    {items.map((item) => (
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
                    ))}
                  </BaseSelect.Group>
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
