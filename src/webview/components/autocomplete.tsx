import { Autocomplete as BaseAutocomplete } from '@base-ui/react/autocomplete';
import { cn } from 'cn';
import { Icon } from '@/webview/components/icons';
import { Input, type InputProps } from '@/webview/components/input';

export type AutocompleteProps = Omit<InputProps, 'value' | 'onChange' | 'list'> & {
  items: string[];
  value: string;
  onValueChange: (value: string) => void;
};

export function Autocomplete({ items, value, onValueChange, disabled, className, ...props }: AutocompleteProps) {
  return (
    <BaseAutocomplete.Root
      items={items}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      openOnInputClick
      filter={null}
    >
      <BaseAutocomplete.InputGroup className="relative w-full min-w-0">
        <BaseAutocomplete.Input render={<Input {...props} className={cn('pr-7', className)} />} />
        <BaseAutocomplete.Trigger
          aria-label="Show options"
          title="Show options"
          className="absolute inset-y-0 right-0 flex w-7 cursor-pointer items-center justify-center rounded-sm text-(--vscode-input-foreground) hover:bg-(--vscode-toolbar-hoverBackground) disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="chevron-down" size="sm" />
        </BaseAutocomplete.Trigger>
      </BaseAutocomplete.InputGroup>
      <BaseAutocomplete.Portal>
        <BaseAutocomplete.Positioner align="start" sideOffset={4} className="z-50 w-(--anchor-width)">
          <BaseAutocomplete.Popup className="max-h-64 w-full overflow-auto rounded-sm border border-(--vscode-widget-border,var(--vscode-panel-border)) bg-(--vscode-editorWidget-background,var(--vscode-editor-background)) text-xs text-(--vscode-foreground) shadow-sm">
            <BaseAutocomplete.List>
              {(item: string) => (
                <BaseAutocomplete.Item
                  key={item}
                  value={item}
                  className="cursor-pointer px-3 py-1 data-highlighted:bg-(--vscode-list-activeSelectionBackground) data-highlighted:text-(--vscode-list-activeSelectionForeground)"
                >
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
