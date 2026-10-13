import { Checkbox as BaseCheckbox, type CheckboxRootProps } from '@base-ui/react/checkbox';
import { cn } from 'cn';
import { Icon } from '@/webview/components/icons';

export type CheckboxProps = Omit<CheckboxRootProps, 'className'> & {
  className?: string;
  ariaLabel?: string;
};

export function Checkbox({ className, ariaLabel, indeterminate, ...props }: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      aria-label={ariaLabel}
      indeterminate={indeterminate}
      className={cn(
        'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-(--vscode-checkbox-border) bg-(--vscode-checkbox-background) text-(--vscode-checkbox-foreground) data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <BaseCheckbox.Indicator className="grid place-items-center">
        <Icon name={indeterminate ? 'remove' : 'check'} size="sm" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
