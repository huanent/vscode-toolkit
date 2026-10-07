import { Input as BaseInput } from '@base-ui/react/input';
import type { InputProps as BaseInputProps } from '@base-ui/react/input';
import { cn } from 'cn';

export type InputProps = BaseInputProps;

export function Input({ className, ...props }: InputProps) {
  return (
    <BaseInput
      className={cn(
        'h-7 w-full rounded border border-(--vscode-input-border) bg-(--vscode-input-background) px-2 text-xs text-(--vscode-input-foreground) placeholder:text-(--vscode-input-placeholderForeground) focus:border-(--vscode-focusBorder) focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
