import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import type { CheckboxRootProps as BaseCheckboxProps } from '@base-ui/react/checkbox';
import { cn } from 'cn';
import { Icon } from './icons';

export interface CheckboxProps extends Omit<BaseCheckboxProps, 'className'> {
  className?: string;
  ariaLabel?: string;
}

export function Checkbox({ className, ariaLabel, ...props }: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      aria-label={ariaLabel}
      className={cn(
        'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-(--vscode-checkbox-border) bg-(--vscode-checkbox-background) text-(--vscode-checkbox-foreground) data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator className="grid place-items-center">
        <Icon name={props.indeterminate ? 'remove' : 'check'} size="sm" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
