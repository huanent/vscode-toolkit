import { Autocomplete as BaseAutocomplete } from '@base-ui/react/autocomplete';
import { cn } from 'cn';
import { Button } from '@/webview/components/button';
import { Icon } from '@/webview/components/icons';
import { Input, type InputProps } from '@/webview/components/input';
import { popupClassName, popupItemClassName } from '@/webview/components/surface-styles';

export type AutocompleteProps = Omit<InputProps, 'value' | 'onChange' | 'list'> & {
  items: readonly string[];
  value: string;
  onValueChange: (value: string) => void;
};

export function Autocomplete({ items, value, onValueChange, disabled, suffix, ...props }: AutocompleteProps) {
  return (
    <BaseAutocomplete.Root
      items={items}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
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
                <BaseAutocomplete.Item key={item} value={item} className={popupItemClassName}>
                  {item}
                </BaseAutocomplete.Item>
              )}
            </BaseAutocomplete.List>
          </BaseAutocomplete.Popup>
        </BaseAutocomplete.Positioner>
      </BaseAutocomplete.Portal>
    </BaseAutocomplete.Root>
  );
}
