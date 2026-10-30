import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { cn } from 'cn';
import { Icon } from '@/webview/components/ui/icons';
import {
  fieldClassName,
  glassPopupClassName,
  popupClassName,
  popupItemClassName,
} from '@/webview/components/ui/surface-styles';

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  ariaLabel: string;
}) {
  return (
    <BaseCombobox.Root
      items={options}
      inputValue={value}
      onInputValueChange={onValueChange}
      onValueChange={(item) => {
        if (typeof item === 'string') onValueChange(item);
      }}
    >
      <div className="relative">
        <BaseCombobox.Input
          aria-label={ariaLabel}
          placeholder={placeholder}
          className={cn(fieldClassName, 'w-full pr-7')}
        />
        <BaseCombobox.Trigger
          aria-label="Show options"
          className="absolute inset-y-0 right-1 flex items-center text-(--vscode-descriptionForeground)"
        >
          <Icon name="chevron-down" size="sm" />
        </BaseCombobox.Trigger>
      </div>
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner sideOffset={4} className="z-50">
          <BaseCombobox.Popup
            className={cn(
              popupClassName,
              glassPopupClassName,
              'w-(--anchor-width) max-w-(--available-width) overflow-hidden',
            )}
          >
            <BaseCombobox.Empty className="px-2 py-1 text-(--vscode-descriptionForeground)">
              No matching commands
            </BaseCombobox.Empty>
            <BaseCombobox.List className="max-h-60 overflow-y-auto py-1">
              {(item: string) => (
                <BaseCombobox.Item key={item} value={item} className={popupItemClassName}>
                  {item}
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
