import { Autocomplete as BaseAutocomplete } from '@base-ui/react/autocomplete';
import { cn } from 'cn';
import type { ReactNode } from 'react';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Input, type InputProps } from '@/webview/components/input';
import { popupClassName, popupItemClassName } from '@/webview/components/surface-styles';

export type AutocompleteProps = Omit<InputProps, 'value' | 'onChange' | 'list'> & {
  items: readonly string[];
  value: string;
  onValueChange: (value: string) => void;
  defaultOpen?: boolean;
  showTrigger?: boolean;
  onItemSelect?: (value: string) => void;
  itemActions?: (value: string) => ReactNode;
};

export function Autocomplete({
  items,
  value,
  onValueChange,
  disabled,
  suffix,
  defaultOpen,
  showTrigger = true,
  onItemSelect,
  itemActions,
  ...props
}: AutocompleteProps) {
  return (
    <BaseAutocomplete.Root
      items={items}
      value={value}
      onValueChange={(nextValue, details) => {
        onValueChange(nextValue);
        if (details.reason === 'item-press') onItemSelect?.(nextValue);
      }}
      disabled={disabled}
      defaultOpen={defaultOpen}
      openOnInputClick
      filter={null}
    >
      <BaseAutocomplete.InputGroup className="w-full min-w-0">
        <BaseAutocomplete.Input
          render={
            <Input
              {...props}
              disabled={disabled}
              suffix={
                <>
                  {suffix}
                  {showTrigger && (
                    <BaseAutocomplete.Trigger
                      render={
                        <Button
                          variant="ghost"
                          size="sm"
                          prefix={<Icon name="chevron-down" size="sm" />}
                          aria-label="Show options"
                          title="Show options"
                        />
                      }
                    />
                  )}
                </>
              }
            />
          }
        />
      </BaseAutocomplete.InputGroup>
      <BaseAutocomplete.Portal>
        <BaseAutocomplete.Positioner align="start" sideOffset={4} className="z-50 w-(--anchor-width)">
          <BaseAutocomplete.Popup className={cn(popupClassName, 'max-h-64 w-full overflow-auto')}>
            <BaseAutocomplete.List>
              {(item: string) => (
                <div
                  key={item}
                  className={cn(
                    popupItemClassName,
                    'group hover:bg-(--vscode-list-activeSelectionBackground) hover:text-(--vscode-list-activeSelectionForeground) has-data-highlighted:bg-(--vscode-list-activeSelectionBackground) has-data-highlighted:text-(--vscode-list-activeSelectionForeground)',
                  )}
                >
                  <BaseAutocomplete.Item
                    value={item}
                    className="flex min-w-0 flex-1 items-center self-stretch outline-none"
                  >
                    <span className="truncate" title={item}>
                      {item}
                    </span>
                  </BaseAutocomplete.Item>
                  {itemActions && (
                    <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                      {itemActions(item)}
                    </div>
                  )}
                </div>
              )}
            </BaseAutocomplete.List>
          </BaseAutocomplete.Popup>
        </BaseAutocomplete.Positioner>
      </BaseAutocomplete.Portal>
    </BaseAutocomplete.Root>
  );
}
